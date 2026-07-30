#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# FROZEN BACKUP — EAS *cloud* build + auto-submit (pre–local-default, 2026-07-27)
#
# Active script:  scripts/deploy-store.sh  (default: eas build --local)
# Restore cloud:  npm run deploy -- --cloud
#   or run this file: bash scripts/deploy-store.eas-cloud-backup.sh
# Tracked on plan: https://gustra.net/plan/ (chg-20260727-deploy-local)
# ═══════════════════════════════════════════════════════════════════════════
#
# Upload builds for testers only (TestFlight / Play Internal).
# Never submits a public App Store or Play production release.
#
# Default = overview + optional upload (double confirm).
# Real upload:  npm run deploy -- --go
#               bash scripts/deploy-store.sh --go
#
# Options:
#   --go                 Jump to double confirmation, then bump + EAS + commit
#   --platform TARGET    ios | android | both  (skips platform prompt)
#   --ios-group GROUP    Internal | Developer  (TestFlight internal group; iOS only)
#   --help               Show usage
#
# Env (optional):
#   DEPLOY_PLATFORM      ios | android | both
#   DEPLOY_IOS_GROUP     Internal | Developer
#   DEPLOY_CONFIRM1      "1" for yes when using --go without a TTY
#   DEPLOY_CONFIRM2      "1" for yes (second confirm) without a TTY
#
# No release notes / --what-to-test: EAS changelog requires Enterprise.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/app.config.ts"
cd "$ROOT"

DO_UPLOAD=0
PLATFORM_ARG="${DEPLOY_PLATFORM:-}"
IOS_GROUP_ARG="${DEPLOY_IOS_GROUP:-}"

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-store.sh [--go] [--platform ios|android|both] [--ios-group Internal|Developer]

  Uploads tester builds only (TestFlight / Play Internal) — not a public store release.
  Does not ask for notes (EAS What to Test / changelog needs Enterprise).

  For iOS, pick a TestFlight *internal* group (names must match App Store Connect):
    Internal   → submit profile testflight-internal
    Developer  → submit profile testflight-developer

  Default: overview first, then optional upload with double confirm (1 = ja, twice).
  Pass --go to jump straight to the double confirmation.

  npm run deploy                              # interactive
  npm run deploy -- --ios-group Developer     # iOS group without prompt
  npm run deploy -- --go --platform ios --ios-group Internal
  npm run deploy:ios                          # iOS → TestFlight (asks group)
  npm run deploy:android                      # Android → Play Internal
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --go) DO_UPLOAD=1; shift ;;
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

if [[ ! -t 0 ]]; then
  if [[ -z "$PLATFORM_ARG" ]]; then
    echo "Geen TTY: geef --platform (of DEPLOY_PLATFORM)." >&2
    echo "Voor upload zonder TTY: DEPLOY_CONFIRM1=1 DEPLOY_CONFIRM2=1 … --go" >&2
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
  echo "" >&2
  echo "Naar welke TestFlight-groep (internal)?" >&2
  echo "  1) Internal" >&2
  echo "  2) Developer" >&2
  local choice
  while true; do
    read -r -p "Keuze [1/2]: " choice
    case "$choice" in
      1|i|I|internal|Internal|INTERNAL) echo "Internal"; return ;;
      2|d|D|developer|Developer|DEVELOPER) echo "Developer"; return ;;
      *) echo "Kies 1 of 2." >&2 ;;
    esac
  done
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

normalize_ios_group() {
  case "$1" in
    Internal|internal|INTERNAL|1) echo "Internal" ;;
    Developer|developer|DEVELOPER|2) echo "Developer" ;;
    *)
      echo "Ongeldige iOS-groep: $1 (verwacht Internal|Developer)" >&2
      exit 1
      ;;
  esac
}

submit_profile_for_group() {
  case "$1" in
    Internal) echo "testflight-internal" ;;
    Developer) echo "testflight-developer" ;;
    *)
      echo "Geen submit-profile voor groep: $1" >&2
      exit 1
      ;;
  esac
}

echo "" >&2
echo "════════════════════════════════════════" >&2
echo "  Gustra → upload voor testers" >&2
echo "  iOS: TestFlight · Android: Play Internal" >&2
echo "  Geen publieke App Store / Play release" >&2
echo "  (geen notes — EAS What to Test = Enterprise)" >&2
if [[ "$DO_UPLOAD" -eq 1 ]]; then
  echo "  Modus: direct naar dubbele bevestiging (--go)" >&2
else
  echo "  Modus: overzicht eerst, daarna optioneel uploaden" >&2
  echo "  (dubbele bevestiging: 2× keuze 1 = Ja)" >&2
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
    echo "Geen TTY: geef --ios-group Internal|Developer (of DEPLOY_IOS_GROUP)." >&2
    exit 1
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
IOS_NEXT=$((IOS_CURRENT + 1))
AND_NEXT=$((AND_CURRENT + 1))

echo ""
echo "════════════════════════════════════════"
echo "  Overzicht"
echo "  (geen App Store / Play public release)"
echo "════════════════════════════════════════"
echo "Platform: $PLATFORM"
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  echo "iOS buildNumber: $IOS_CURRENT → $IOS_NEXT  (TestFlight → $IOS_GROUP)"
  echo "iOS submit profile: $IOS_SUBMIT_PROFILE"
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  echo "Android versionCode: $AND_CURRENT → $AND_NEXT  (Play Internal)"
fi
echo ""
echo "Bij upload gebeurt dit:"
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  echo "  • bump ios.buildNumber → $IOS_NEXT"
  echo "  • eas build → TestFlight groep \"$IOS_GROUP\""
  echo "  • git commit"
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  echo "  • bump android.versionCode → $AND_NEXT"
  echo "  • eas build → Play Internal"
  echo "  • git commit"
fi
echo ""
if [[ -n "$IOS_GROUP" ]]; then
  echo "Tip: ASC 'Enable automatic distribution' kan builds alsnog aan andere internal groups toevoegen."
  echo ""
fi

if [[ ! -t 0 && "$DO_UPLOAD" -eq 0 ]]; then
  echo "Dry-run klaar (geen TTY) — niets geüpload."
  exit 0
fi

dest_label="testers"
case "$PLATFORM" in
  ios) dest_label="TestFlight / $IOS_GROUP (iPhone)" ;;
  android) dest_label="Play Internal (Android)" ;;
  both) dest_label="TestFlight / $IOS_GROUP + Play Internal" ;;
esac

ask_yes_no() {
  local title="$1"
  echo "$title" >&2
  echo "  1) Ja" >&2
  echo "  2) Nee / stoppen" >&2
  local choice
  if [[ -t 0 ]]; then
    read -r -p "Keuze [1/2]: " choice
  else
    choice="${2:-}"
    echo "Keuze [1/2]: $choice" >&2
  fi
  case "$choice" in
    1|j|J|ja|Ja|y|Y|yes|YES) return 0 ;;
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
echo "Oké. Upload starten…"
echo ""

commit_bump() {
  local title="$1"
  git add app.config.ts
  git commit -m "$(cat <<EOF
${title}

EOF
)"
}

deploy_ios() {
  local current next profile group
  current="$(read_ios_build)"
  next=$((current + 1))
  profile="$IOS_SUBMIT_PROFILE"
  group="$IOS_GROUP"
  sed -i '' -E "s/(buildNumber: ')${current}(')/\1${next}\2/" "$CONFIG"
  echo "buildNumber: $current → $next"
  echo "TestFlight groep: $group (submit profile: $profile)"

  cleanup_on_fail() {
    # Keep the bumped number: EAS already packaged this buildNumber into the upload.
    echo "iOS build/submit mislukt — buildNumber blijft ${next} (niet teruggezet)." >&2
    echo "Check de build op expo.dev. Submit desnoods handmatig." >&2
  }
  trap cleanup_on_fail ERR

  # No --what-to-test (EAS changelog / Enterprise only).
  EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
    --platform ios \
    --profile production \
    --auto-submit-with-profile "$profile" \
    --non-interactive

  trap - ERR
  commit_bump "Bump iOS buildNumber to ${next} for TestFlight (${group})."
  echo "Klaar: iOS build ${next} → TestFlight groep \"${group}\"."
}

deploy_android() {
  local current next
  current="$(read_android_code)"
  next=$((current + 1))
  sed -i '' -E "s/(versionCode: )${current}/\1${next}/" "$CONFIG"
  echo "versionCode: $current → $next"

  cleanup_on_fail() {
    echo "Android build/submit mislukt — versionCode blijft ${next} (niet teruggezet)." >&2
    echo "Check de build op expo.dev vóór je opnieuw uploadt." >&2
  }
  trap cleanup_on_fail ERR

  EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
    --platform android \
    --profile production \
    --auto-submit \
    --non-interactive

  trap - ERR
  commit_bump "Bump Android versionCode to ${next} for Play Internal testing."
  echo "Klaar: Android versionCode ${next} → Play Internal."
}

if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  deploy_ios
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  deploy_android
fi

echo ""
echo "Alles klaar."
