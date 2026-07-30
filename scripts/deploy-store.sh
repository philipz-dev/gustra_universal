#!/usr/bin/env bash
# Upload builds for testers only (TestFlight / Play Internal).
# Never submits a public App Store or Play production release.
#
# Default = *local* EAS build (no cloud queue / build credits), then submit.
# Cloud fallback (old behaviour): --cloud
# Frozen copy of pre-local script: scripts/deploy-store.eas-cloud-backup.sh
#
# Default = overview + optional upload (double confirm).
# Real upload:  npm run deploy -- --go
#               bash scripts/deploy-store.sh --go
#
# Options:
#   --go                 Jump to double confirmation, then bump + EAS + commit
#   --local              Build on this Mac (default) — eas build --local
#   --cloud              Build on Expo servers (old path; uses build credits)
#   --platform TARGET    ios | android | both  (skips platform prompt)
#   --ios-group GROUP    Internal | Developer — reminder which ASC group should
#                        auto-receive the build (default Developer). Not passed to
#                        Apple via API (that fails with “Cannot add internal group”).
#   --help               Show usage
#
# Build numbers: ios.buildNumber and android.versionCode stay equal.
# Each upload bumps max(ios, android) + 1 and writes both fields (even if only
# one platform is built), so TestFlight and Play show the same 1.0 (N).
#
# Env (optional):
#   DEPLOY_PLATFORM      ios | android | both
#   DEPLOY_IOS_GROUP     Internal | Developer  (default Developer when unset + no TTY)
#   DEPLOY_BUILD_MODE    local | cloud
#   DEPLOY_CONFIRM1      "Y" for yes when using --go without a TTY
#   DEPLOY_CONFIRM2      "Y" for yes (second confirm) without a TTY
#   SENTRY_AUTH_TOKEN    (from .env / .env.local) — source map upload during archive
#   SENTRY_ALLOW_FAILURE default true so missing/invalid token does not fail the archive
#
# iOS submit: upload only (no eas.json `groups`). Enable “automatic distribution”
# on the Internal/Developer group in App Store Connect so testers still get builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)/.."
ROOT="$(cd "$ROOT" && pwd)"
CONFIG="$ROOT/app.config.ts"
cd "$ROOT"

# Export Sentry vars into the EAS/Xcode build env (local --local does not auto-load .env.local).
load_sentry_deploy_env() {
  local f line key val
  for f in "$ROOT/.env" "$ROOT/.env.local"; do
    [[ -f "$f" ]] || continue
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue
      key="${line%%=*}"
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      case "$key" in
        SENTRY_AUTH_TOKEN|SENTRY_ORG|SENTRY_PROJECT|EXPO_PUBLIC_SENTRY_DSN)
          val="${line#*=}"
          val="${val%\"}"
          val="${val#\"}"
          val="${val%\'}"
          val="${val#\'}"
          export "$key=$val"
          ;;
      esac
    done <"$f"
  done
  # Never brick TestFlight on sentry-cli auth / network glitches.
  export SENTRY_ALLOW_FAILURE="${SENTRY_ALLOW_FAILURE:-true}"
  if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
    echo "Sentry: AUTH_TOKEN geladen (source maps upload tijdens archive; failure toegestaan)."
  else
    echo "Sentry: geen AUTH_TOKEN — archive gaat door (SENTRY_ALLOW_FAILURE=true)."
  fi
}

# Local EAS only forwards eas.json profile `env` into Xcode (shell alone is not enough).
# Temporarily merge Sentry keys into production.env; restore afterwards (never leave token in eas.json).
EAS_JSON="$ROOT/eas.json"
EAS_JSON_BAK=""
restore_eas_sentry_env() {
  if [[ -n "${EAS_JSON_BAK:-}" && -f "$EAS_JSON_BAK" ]]; then
    mv -f "$EAS_JSON_BAK" "$EAS_JSON"
    EAS_JSON_BAK=""
  fi
}
inject_eas_sentry_env() {
  restore_eas_sentry_env
  EAS_JSON_BAK="$(mktemp "${TMPDIR:-/tmp}/eas.json.XXXXXX")"
  cp "$EAS_JSON" "$EAS_JSON_BAK"
  SENTRY_ALLOW_FAILURE="${SENTRY_ALLOW_FAILURE:-true}" \
  SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}" \
  SENTRY_ORG="${SENTRY_ORG:-}" \
  SENTRY_PROJECT="${SENTRY_PROJECT:-}" \
  EXPO_PUBLIC_SENTRY_DSN="${EXPO_PUBLIC_SENTRY_DSN:-}" \
  EAS_JSON="$EAS_JSON" python3 - <<'PY'
import json, os
path = os.environ["EAS_JSON"]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
env = data.setdefault("build", {}).setdefault("production", {}).setdefault("env", {})
env["SENTRY_ALLOW_FAILURE"] = os.environ.get("SENTRY_ALLOW_FAILURE") or "true"
for key in ("SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT", "EXPO_PUBLIC_SENTRY_DSN"):
    val = (os.environ.get(key) or "").strip()
    if val:
        env[key] = val
    else:
        env.pop(key, None)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

load_sentry_deploy_env

DO_UPLOAD=0
PLATFORM_ARG="${DEPLOY_PLATFORM:-}"
IOS_GROUP_ARG="${DEPLOY_IOS_GROUP:-}"
BUILD_MODE="${DEPLOY_BUILD_MODE:-local}"

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-store.sh [--go] [--local|--cloud] [--platform ios|android|both] [--ios-group Internal|Developer]

  Uploads tester builds only (TestFlight / Play Internal) — not a public store release.
  Does not ask for notes (EAS What to Test / changelog needs Enterprise).

  Build mode:
    --local   (default) eas build --local on this machine — no EAS cloud queue
    --cloud           eas build on Expo servers (old behaviour; see
                      scripts/deploy-store.eas-cloud-backup.sh)

  For iOS, pick which TestFlight group should receive the build (default: Developer).
  That choice is a reminder for App Store Connect — we do NOT pass eas.json groups
  (Apple: Cannot add internal group to a build when automatic distribution is on).
  Submit uses the production profile (upload only).

  Default: overview first, then optional upload with double confirm (2× typ Y).
  Pass --go to jump straight to the double confirmation.

  npm run deploy                              # interactive (local build)
  npm run deploy -- --cloud                   # Expo cloud build
  npm run deploy -- --go --platform ios
  npm run deploy -- --ios-group Internal
  npm run deploy:ios                          # iOS → TestFlight
  npm run deploy:android                      # Android → Play Internal
  npm run deploy:cloud                        # same as --cloud

  ios.buildNumber and android.versionCode stay equal (bumped together).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --go) DO_UPLOAD=1; shift ;;
    --local) BUILD_MODE=local; shift ;;
    --cloud) BUILD_MODE=cloud; shift ;;
    --platform)
      PLATFORM_ARG="${2:-}"
      shift 2
      ;;
    --platform=*)
      PLATFORM_ARG="${1#*=}"
      shift
      ;;
    --ios-group)
      IOS_GROUP_ARG="${2:-}"
      shift 2
      ;;
    --ios-group=*)
      IOS_GROUP_ARG="${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Onbekende optie: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$BUILD_MODE" in
  local|cloud) ;;
  *)
    echo "Ongeldige BUILD_MODE: $BUILD_MODE (verwacht local|cloud)" >&2
    exit 1
    ;;
esac

if [[ ! -t 0 ]]; then
  if [[ -z "$PLATFORM_ARG" ]]; then
    echo "Geen TTY: geef --platform (of DEPLOY_PLATFORM)." >&2
    echo "Voor upload zonder TTY: DEPLOY_CONFIRM1=Y DEPLOY_CONFIRM2=Y … --go" >&2
    exit 1
  fi
fi

read_ios_build() {
  grep -E "buildNumber:\s*'" "$CONFIG" | head -1 | sed -E "s/.*buildNumber: '([0-9]+)'.*/\1/"
}

read_android_code() {
  grep -E "versionCode:\s*[0-9]+" "$CONFIG" | head -1 | sed -E "s/.*versionCode: ([0-9]+).*/\1/"
}

prompt_platform() {
  # UI must go to stderr — stdout is captured by $(prompt_platform).
  echo "" >&2
  echo "Voor welk platform wil je een build?" >&2
  echo "  1) iOS     → TestFlight" >&2
  echo "  2) Android → Play Internal testing" >&2
  echo "  3) Beide" >&2
  local choice
  while true; do
    read -r -p "Keuze [1/2/3]: " choice
    case "$choice" in
      1|i|ios|IOS) echo "ios"; return ;;
      2|a|android|Android) echo "android"; return ;;
      3|b|beide|both|BOTH) echo "both"; return ;;
      *) echo "Kies 1, 2 of 3." >&2 ;;
    esac
  done
}

prompt_ios_group() {
  # UI must go to stderr — stdout is captured by $(prompt_ios_group).
  echo "" >&2
  echo "Welke TestFlight-groep moet de build ontvangen?" >&2
  echo "  (Upload-only — ASC ‘automatic distribution’ moet aan staan op die groep.)" >&2
  echo "  D) Developer  ← default" >&2
  echo "  I) Internal" >&2
  local choice
  while true; do
    read -r -p "Keuze [D/I, Enter=Developer]: " choice
    case "$choice" in
      ""|d|D|developer|Developer|DEVELOPER) echo "Developer"; return ;;
      i|I|internal|Internal|INTERNAL) echo "Internal"; return ;;
      *) echo "Kies D (Developer) of I (Internal), of Enter voor Developer." >&2 ;;
    esac
  done
}

normalize_ios_group() {
  case "$1" in
    Internal|internal|INTERNAL|i|I) echo "Internal" ;;
    Developer|developer|DEVELOPER|d|D|"") echo "Developer" ;;
    *)
      echo "Ongeldige iOS-groep: $1 (verwacht Internal|Developer)" >&2
      exit 1
      ;;
  esac
}

submit_profile_for_group() {
  # Always production: no `groups` in eas.json (Apple rejects assigning Internal/
  # Developer when automatic distribution is enabled — upload alone is enough).
  echo "production"
}

normalize_platform() {
  case "$1" in
    ios|iOS|IOS|1) echo "ios" ;;
    android|Android|ANDROID|2) echo "android" ;;
    both|beide|BOTH|3) echo "both" ;;
    *)
      echo "Ongeldig platform: $1 (verwacht ios|android|both)" >&2
      exit 1
      ;;
  esac
}

build_mode_label="lokaal (eas --local)"
if [[ "$BUILD_MODE" == "cloud" ]]; then
  build_mode_label="Expo cloud"
fi

echo "" >&2
echo "════════════════════════════════════════" >&2
echo "  Gustra → upload voor testers" >&2
echo "  iOS: TestFlight · Android: Play Internal" >&2
echo "  Geen publieke App Store / Play release" >&2
echo "  Build: $build_mode_label" >&2
echo "  (geen notes — EAS What to Test = Enterprise)" >&2
if [[ "$DO_UPLOAD" -eq 1 ]]; then
  echo "  Modus: direct naar dubbele bevestiging (--go)" >&2
else
  echo "  Modus: overzicht eerst, daarna optioneel uploaden" >&2
  echo "  (dubbele bevestiging: 2× typ Y)" >&2
fi
echo "════════════════════════════════════════" >&2

if [[ -n "$PLATFORM_ARG" ]]; then
  PLATFORM="$(normalize_platform "$PLATFORM_ARG")"
else
  PLATFORM="$(normalize_platform "$(prompt_platform)")"
fi

IOS_GROUP=""
IOS_SUBMIT_PROFILE=""
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  if [[ -n "$IOS_GROUP_ARG" ]]; then
    IOS_GROUP="$(normalize_ios_group "$IOS_GROUP_ARG")"
  elif [[ -t 0 ]]; then
    IOS_GROUP="$(normalize_ios_group "$(prompt_ios_group)")"
  else
    IOS_GROUP="Developer"
    echo "Geen TTY: TestFlight-groep = Developer (default). Override: --ios-group / DEPLOY_IOS_GROUP." >&2
  fi
  IOS_SUBMIT_PROFILE="$(submit_profile_for_group "$IOS_GROUP")"
fi

IOS_CURRENT="$(read_ios_build)"
AND_CURRENT="$(read_android_code)"
if [[ -z "$IOS_CURRENT" || ! "$IOS_CURRENT" =~ ^[0-9]+$ ]]; then
  echo "Kon ios.buildNumber niet lezen uit app.config.ts" >&2
  exit 1
fi
if [[ -z "$AND_CURRENT" || ! "$AND_CURRENT" =~ ^[0-9]+$ ]]; then
  echo "Kon android.versionCode niet lezen uit app.config.ts" >&2
  exit 1
fi
# Shared store build: always max+1 so both platforms show 1.0 (N).
if [[ "$IOS_CURRENT" -ge "$AND_CURRENT" ]]; then
  SHARED_CURRENT="$IOS_CURRENT"
else
  SHARED_CURRENT="$AND_CURRENT"
fi
SHARED_NEXT=$((SHARED_CURRENT + 1))

echo ""
echo "════════════════════════════════════════"
echo "  Overzicht"
echo "  (geen App Store / Play public release)"
echo "════════════════════════════════════════"
echo "Platform: $PLATFORM"
echo "Build mode: $BUILD_MODE ($build_mode_label)"
echo "Shared build: $SHARED_CURRENT → $SHARED_NEXT  (iOS buildNumber = Android versionCode)"
if [[ "$IOS_CURRENT" != "$AND_CURRENT" ]]; then
  echo "  (was out of sync: iOS $IOS_CURRENT · Android $AND_CURRENT — next deploy aligns both)"
fi
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  echo "iOS → TestFlight upload (groep $IOS_GROUP via ASC auto-distribution; geen API groups)"
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  echo "Android → Play Internal"
fi
echo ""
echo "Bij upload gebeurt dit:"
echo "  • bump ios.buildNumber + android.versionCode → $SHARED_NEXT"
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  if [[ "$BUILD_MODE" == "local" ]]; then
    echo "  • eas build --local → eas submit --path (TestFlight upload)"
  else
    echo "  • eas build (cloud) → auto-submit TestFlight upload"
  fi
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  if [[ "$BUILD_MODE" == "local" ]]; then
    echo "  • eas build --local → Play Internal"
  else
    echo "  • eas build (cloud) → Play Internal"
  fi
fi
echo "  • git commit (één bump voor beide platformen)"
if [[ "$BUILD_MODE" == "cloud" ]]; then
  echo ""
  echo "Cloud-backup script: scripts/deploy-store.eas-cloud-backup.sh"
fi
echo ""
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  echo "Tip: ASC → TestFlight → groep “$IOS_GROUP” → Enable automatic distribution."
  echo "     Script assign’t geen groups via API (anders: Cannot add internal group)."
  echo ""
fi

if [[ ! -t 0 && "$DO_UPLOAD" -eq 0 ]]; then
  echo "Dry-run klaar (geen TTY) — niets geüpload."
  exit 0
fi

dest_label="testers"
case "$PLATFORM" in
  ios) dest_label="TestFlight /$IOS_GROUP" ;;
  android) dest_label="Play Internal (Android)" ;;
  both) dest_label="TestFlight /$IOS_GROUP + Play Internal" ;;
esac

ask_yes_no() {
  local title="$1"
  local env_default="${2:-}"
  echo "$title" >&2
  echo "  Typ Y om te bevestigen (iets anders = stoppen)" >&2
  local choice
  if [[ -t 0 ]]; then
    read -r -p "Bevestiging [Y]: " choice
  else
    choice="$env_default"
    echo "Bevestiging [Y]: $choice" >&2
  fi
  case "$choice" in
    Y|y|yes|YES|ja|Ja|j|J) return 0 ;;
    *) return 1 ;;
  esac
}

echo "Upload naar ${dest_label}?"
if ! ask_yes_no "Bevestiging 1/2" "${DEPLOY_CONFIRM1:-}"; then
  echo "Gestopt — niets geüpload."
  exit 0
fi
echo ""
if ! ask_yes_no "Bevestiging 2/2 — zeker weten? (geen publieke store release)" "${DEPLOY_CONFIRM2:-}"; then
  echo "Afgebroken — niets geüpload."
  exit 0
fi

echo ""
echo "Oké. Upload starten… (build: $BUILD_MODE)"
echo ""

commit_bump() {
  local title="$1"
  git add app.config.ts
  git commit -m "$(cat <<EOF
${title}

EOF
)"
}

bump_shared_build() {
  local ios_cur and_cur next
  ios_cur="$(read_ios_build)"
  and_cur="$(read_android_code)"
  next="$SHARED_NEXT"
  sed -i '' -E "s/(buildNumber: ')${ios_cur}(')/\1${next}\2/" "$CONFIG"
  sed -i '' -E "s/(versionCode: )${and_cur}/\1${next}/" "$CONFIG"
  echo "Shared build: iOS ${ios_cur} + Android ${and_cur} → ${next}"
}

deploy_ios() {
  local profile next
  profile="${IOS_SUBMIT_PROFILE:-production}"
  next="$SHARED_NEXT"
  echo "TestFlight submit profile: $profile (upload only — groep $IOS_GROUP via ASC auto-distribution)"
  echo "Build mode: $BUILD_MODE · build $next"

  cleanup_on_fail() {
    restore_eas_sentry_env
    echo "iOS build/submit mislukt — shared build blijft ${next} (niet teruggezet)." >&2
    if [[ "$BUILD_MODE" == "local" ]]; then
      echo "Lokale build: check Xcode/logs. Cloud-fallback: npm run deploy -- --cloud --platform ios" >&2
    else
      echo "Check de build op expo.dev. Submit desnoods handmatig." >&2
    fi
  }
  trap cleanup_on_fail ERR

  # Inject Sentry env into eas.json for this build (local Xcode only sees profile env).
  inject_eas_sentry_env

  # No --what-to-test (EAS changelog / Enterprise only).
  # Local builds cannot use --auto-submit*; write artifact then submit --path
  # (--latest only sees finished *cloud* builds, so it would re-upload an old IPA).
  if [[ "$BUILD_MODE" == "local" ]]; then
    local ipa_out
    ipa_out="$ROOT/build-${next}-ios.ipa"
    EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
      --platform ios \
      --profile production \
      --local \
      --output "$ipa_out" \
      --non-interactive
    restore_eas_sentry_env
    echo "Submit lokale IPA: $ipa_out (niet --latest / cloud)."
    npx eas-cli submit \
      --platform ios \
      --profile "$profile" \
      --path "$ipa_out" \
      --non-interactive
  else
    EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
      --platform ios \
      --profile production \
      --auto-submit-with-profile "$profile" \
      --non-interactive
    restore_eas_sentry_env
  fi

  trap - ERR
  echo "Klaar: iOS build ${next} → TestFlight upload ($BUILD_MODE; ASC → $IOS_GROUP)."
}

deploy_android() {
  local next
  next="$SHARED_NEXT"
  echo "Build mode: $BUILD_MODE · versionCode $next"

  cleanup_on_fail() {
    restore_eas_sentry_env
    echo "Android build/submit mislukt — shared build blijft ${next} (niet teruggezet)." >&2
    if [[ "$BUILD_MODE" == "local" ]]; then
      echo "Lokale build: check Android SDK/logs. Cloud-fallback: npm run deploy -- --cloud --platform android" >&2
      echo "Play service account: npm run deploy:credentials  (eas.json path + Play invite)" >&2
    else
      echo "Check de build op expo.dev vóór je opnieuw uploadt." >&2
    fi
  }
  trap cleanup_on_fail ERR

  inject_eas_sentry_env

  # Local builds cannot use --auto-submit; write AAB then submit --path
  # (--latest only sees finished *cloud* builds).
  if [[ "$BUILD_MODE" == "local" ]]; then
    local aab_out
    aab_out="$ROOT/build-${next}-android.aab"
    EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
      --platform android \
      --profile production \
      --local \
      --output "$aab_out" \
      --non-interactive
    restore_eas_sentry_env
    echo "Submit lokale AAB: $aab_out (niet --latest / cloud)."
    npx eas-cli submit \
      --platform android \
      --profile production \
      --path "$aab_out" \
      --non-interactive
  else
    EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
      --platform android \
      --profile production \
      --auto-submit \
      --non-interactive
    restore_eas_sentry_env
  fi

  trap - ERR
  echo "Klaar: Android versionCode ${next} → Play Internal ($BUILD_MODE)."
}

bump_shared_build

if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  deploy_ios
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  deploy_android
fi

commit_bump "Bump shared store build to ${SHARED_NEXT} (${PLATFORM}, ${BUILD_MODE})."

echo ""
echo "Alles klaar — beide platforms op build ${SHARED_NEXT}."
