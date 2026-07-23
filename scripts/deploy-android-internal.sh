#!/usr/bin/env bash
# Bump android.versionCode, EAS production build + auto-submit (Play Internal testing), then commit the bump.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/app.config.ts"

cd "$ROOT"

current=$(grep -E "versionCode:\s*[0-9]+" "$CONFIG" | head -1 | sed -E "s/.*versionCode: ([0-9]+).*/\1/")
if [[ -z "$current" || ! "$current" =~ ^[0-9]+$ ]]; then
  echo "Kon android.versionCode niet lezen uit app.config.ts" >&2
  exit 1
fi

next=$((current + 1))
sed -i '' -E "s/(versionCode: )${current}/\1${next}/" "$CONFIG"
echo "versionCode: $current → $next"

cleanup_on_fail() {
  echo "Build/submit mislukt — versionCode teruggezet naar $current" >&2
  sed -i '' -E "s/(versionCode: )${next}/\1${current}/" "$CONFIG"
}
trap cleanup_on_fail ERR

EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile production --auto-submit --non-interactive

trap - ERR

git add app.config.ts
git commit -m "$(cat <<EOF
Bump Android versionCode to ${next} for Play Internal testing.

EOF
)"

echo "Klaar: versionCode ${next} geüpload naar Play Internal testing; bump gecommit."
