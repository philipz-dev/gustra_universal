#!/usr/bin/env bash
# Upload builds for testers only (TestFlight / Play Internal).
# Never submits a public App Store or Play production release.
#
# Default = dry-run (no bump, no EAS upload, no commit).
# Real upload:  npm run deploy -- --go
#               bash scripts/deploy-store.sh --go
#
# Options:
#   --go                 Actually bump + EAS build/submit to testers + commit
#   --platform TARGET    ios | android | both  (skips platform prompt)
#   --help               Show usage
#
# Env (optional, skips prompts when set):
#   DEPLOY_PLATFORM      ios | android | both
#   DEPLOY_NOTES         what-to-test notes for testers
#   DEPLOY_CONFIRM1      "1" for yes when using --go without a TTY
#   DEPLOY_CONFIRM2      "1" for yes (second confirm) without a TTY
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/app.config.ts"
cd "$ROOT"

DO_UPLOAD=0
PLATFORM_ARG="${DEPLOY_PLATFORM:-}"
NOTES_ARG="${DEPLOY_NOTES:-}"

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-store.sh [--go] [--platform ios|android|both]

  Uploads tester builds only (TestFlight / Play Internal) — not a public store release.

  Default: overview first, then optional upload with double confirm (1 = ja, twice).
  Pass --go to jump straight to the double confirmation.

  npm run deploy                  # interactive; at the end choose 1 twice to upload
  npm run deploy -- --go          # same, jumps to double confirm
  npm run deploy:ios              # iOS → TestFlight
  npm run deploy:android          # Android → Play Internal
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
  # Non-interactive only when platform + notes are supplied (and --go needs confirm env).
  if [[ -z "$PLATFORM_ARG" || -z "$NOTES_ARG" ]]; then
    echo "Geen TTY: geef --platform en DEPLOY_NOTES=… (of DEPLOY_PLATFORM)." >&2
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
  echo "Voor welke testers wil je een build?" >&2
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

prompt_notes() {
  echo "" >&2
  echo "Plak notes voor testers (what to test)." >&2
  echo "Daarna: lege regel, of een regel met alleen EOF." >&2
  echo "----" >&2
  local notes="" line
  while IFS= read -r line; do
    if [[ -z "$line" || "$line" == "EOF" ]]; then
      break
    fi
    notes+="$line"$'\n'
  done
  # Drop trailing newline from the last pasted line.
  notes="${notes%$'\n'}"
  printf '%s' "$notes"
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

echo "" >&2
echo "════════════════════════════════════════" >&2
echo "  Gustra → upload voor testers" >&2
echo "  iOS: TestFlight · Android: Play Internal" >&2
echo "  Geen publieke App Store / Play release" >&2
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

if [[ -n "$NOTES_ARG" ]]; then
  NOTES="$NOTES_ARG"
else
  NOTES="$(prompt_notes)"
fi

if [[ -z "${NOTES//[[:space:]]/}" ]]; then
  if [[ -t 0 ]]; then
    echo "" >&2
    echo "Geen notes ingevuld. Opnieuw proberen? Anders Enter om leeg door te gaan." >&2
    read -r -p "Notes opnieuw plakken? [j/N]: " retry
    if [[ "$retry" =~ ^[jJyY] ]]; then
      NOTES="$(prompt_notes)"
    fi
  fi
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
  echo "iOS buildNumber: $IOS_CURRENT → $IOS_NEXT  (TestFlight)"
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  echo "Android versionCode: $AND_CURRENT → $AND_NEXT  (Play Internal)"
fi
echo "---- Notes voor testers ----"
if [[ -n "$NOTES" ]]; then
  printf '%s\n' "$NOTES"
else
  echo "(leeg)"
fi
echo "-----------------------"
echo ""
echo "Bij upload gebeurt dit:"
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  echo "  • bump ios.buildNumber → $IOS_NEXT"
  echo "  • eas build → TestFlight"
  echo "  • git commit"
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  echo "  • bump android.versionCode → $AND_NEXT"
  echo "  • eas build → Play Internal"
  echo "  • git commit"
fi
echo ""

if [[ ! -t 0 && "$DO_UPLOAD" -eq 0 ]]; then
  echo "Dry-run klaar (geen TTY) — niets geüpload."
  exit 0
fi

dest_label="testers"
case "$PLATFORM" in
  ios) dest_label="TestFlight (iPhone)" ;;
  android) dest_label="Play Internal (Android)" ;;
  both) dest_label="TestFlight + Play Internal" ;;
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
  if [[ -n "$NOTES" ]]; then
    git commit -m "$(cat <<EOF
${title}

${NOTES}
EOF
)"
  else
    git commit -m "$(cat <<EOF
${title}

EOF
)"
  fi
}

deploy_ios() {
  local current next
  current="$(read_ios_build)"
  next=$((current + 1))
  sed -i '' -E "s/(buildNumber: ')${current}(')/\1${next}\2/" "$CONFIG"
  echo "buildNumber: $current → $next"

  cleanup_on_fail() {
    # Keep the bumped number: EAS already packaged this buildNumber into the upload.
    # Reverting caused local 19 while remote build 20 still existed.
    echo "iOS build/submit mislukt — buildNumber blijft ${next} (niet teruggezet)." >&2
    echo "Check de build op expo.dev. Submit desnoods handmatig zonder --what-to-test." >&2
  }
  trap cleanup_on_fail ERR

  # Do NOT pass --what-to-test: EAS maps it to `changelog` (Enterprise only).
  # Notes stay in the git commit; paste into TestFlight “What to Test” manually if needed.
  EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build \
    --platform ios \
    --profile production \
    --auto-submit \
    --non-interactive

  trap - ERR
  commit_bump "Bump iOS buildNumber to ${next} for TestFlight."
  echo "Klaar: iOS build ${next} → TestFlight."
  if [[ -n "$NOTES" ]]; then
    echo "Notes staan in de git commit. Plak ze desgewenst in TestFlight → What to Test."
  fi
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
  if [[ -n "$NOTES" ]]; then
    echo "Let op: notes staan in de git commit; plak ze desgewenst ook in Play Console."
  fi
}

if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  deploy_ios
fi
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  deploy_android
fi

echo ""
echo "Alles klaar."
