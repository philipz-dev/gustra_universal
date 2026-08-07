#!/usr/bin/env bash
# Controlled test of the deploy path in deploy-store.sh (sequential).
# Uses a throwaway clone with its OWN .git (via --git-dir/--work-tree so the
# parent repo is never touched), and stubs `npx` so no eas-cli is ever invoked.
# Run manually after editing deploy-store.sh:
#   bash scripts/test-parallel-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/deploy-store.sh"
TMP="$ROOT/.test-deploy-clone"
G() { git --git-dir="$TMP/.git" --work-tree="$TMP" "$@"; }

# ── Clone from HEAD (without the parent repo's .git) ────────────────────────
rm -rf "$TMP"
mkdir -p "$TMP"
git -C "$ROOT" archive HEAD | tar -x -C "$TMP" 2>/dev/null || true
cp "$SCRIPT" "$TMP/scripts/deploy-store.sh"
cp "$ROOT/.gitignore" "$TMP/.gitignore"
G init -q --template=
G add -A >/dev/null 2>&1
G -c user.name=test -c user.email=test@example.com commit -qm "base"

# ── npx stub inside the clone (deploy draait daar) ──────────────────────────
# `npx eas-cli ...` in deploy-store.sh: we stub `npx` zelf (niet eas-cli), zodat
# de echte eas-cli uit de npx-cache nooit geladen wordt.
STUB="$TMP/.test-stub/bin/npx"
mkdir -p "$(dirname "$STUB")" "$TMP/node_modules/.bin"
make_stub() { # $1 = fail_android (0|1)
  cat > "$STUB" <<EOF
#!/usr/bin/env bash
if [[ "\$1" != "eas-cli" ]]; then
  echo "npx: unexpected command \$1" >> "\$TEST_LOG"
  exit 2
fi
PLATFORM=""
ARGS=("\$@")
for i in "\${!ARGS[@]}"; do
  case "\${ARGS[\$i]}" in
    --platform) PLATFORM="\${ARGS[\$((i+1))]}";;
    --platform=*) PLATFORM="\${ARGS[\$i]#*=}";;
  esac
done
echo "npx eas-cli (platform=\$PLATFORM) fail=$1" >> "\$TEST_LOG"
if [[ "\$PLATFORM" == "android" && "$1" == "1" ]]; then
  echo "simulated android failure" >> "\$TEST_LOG"
  exit 1
fi
exit 0
EOF
  chmod +x "$STUB"
  ln -sf "$STUB" "$TMP/node_modules/.bin/npx"
}
export TEST_LOG="$TMP/.test-stub/eas.log"

run_deploy() {
  PATH="$TMP/node_modules/.bin:$PATH" \
    DEPLOY_PLATFORM=both DEPLOY_CONFIRM1=Y DEPLOY_CONFIRM2=Y \
    bash "$TMP/scripts/deploy-store.sh" --go --platform both 2>&1
}

echo "════════ test 1: both platforms succeed → 1 bump commit ════════"
make_stub 0
rm -f "$TEST_LOG"
OUT1="$(run_deploy || true)"
echo "$OUT1" | tail -8
echo "--- eas log (verwacht: ios 2× ok, android 2× ok) ---"
cat "$TEST_LOG"
echo "--- commits in clone (verwacht 2: base + bump) ---"
G log --oneline | wc -l
echo "--- config in clone (moet 65 zijn) ---"
grep -E "buildNumber|versionCode" "$TMP/app.config.ts" | head -2

echo ""
echo "════════ test 2: android fails → NO bump commit ════════"
make_stub 1
rm -f "$TEST_LOG"
OUT2="$(run_deploy || true)"
echo "$OUT2" | tail -12
echo "--- eas log ---"
cat "$TEST_LOG"
echo "--- commits in clone (verwacht nog steeds 2: base + eerdere bump) ---"
G log --oneline | wc -l
echo "--- .failed marker ---"
ls "$TMP/.deploy-logs/" 2>/dev/null || echo "(geen logs)"

# ── Cleanup ─────────────────────────────────────────────────────────────────
cd "$ROOT"
rm -rf "$TMP"
echo ""
echo "test done (clone opgeruimd)"
