#!/usr/bin/env bash
# One-time checklist: Play service account + (optional) App Store Connect API key
# so `npm run deploy` / eas submit can upload without the Play / ASC web UI.
#
# Usage: bash scripts/setup-store-credentials.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SA_JSON="$ROOT/secrets/gustra-503718-8996d99b6021.json"
PLAY_PACKAGE="net.gustra.app"
SA_EMAIL="gustra-backend@gustra-503718.iam.gserviceaccount.com"

echo ""
echo "════════════════════════════════════════"
echo "  Gustra — store submit credentials"
echo "════════════════════════════════════════"
echo ""

ok=1

# ── Android / Play ──────────────────────────────────────────────────────────
echo "▶ Android (Google Play Internal)"
if [[ -f "$SA_JSON" ]]; then
  email="$(python3 -c "import json; print(json.load(open('$SA_JSON'))['client_email'])")"
  echo "  ✓ Service account JSON: secrets/$(basename "$SA_JSON")"
  echo "    client_email: $email"
  echo "  ✓ eas.json → submit.*.android.serviceAccountKeyPath gezet"
else
  ok=0
  echo "  ✗ Mist: $SA_JSON"
  echo "    Download de JSON-key in Google Cloud / Play API access en zet hem in secrets/"
fi

echo ""
echo "  Eenmalig in Google Cloud (project van de service account):"
echo "    1) Open Android Publisher API:"
echo "       https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=gustra-503718"
echo "       (of het projectnummer uit de foutmelding, bv. 610361597910)"
echo "    2) Enable “Google Play Android Developer API”"
echo "    3) Wacht 1–5 minuten tot de enable propageert"
echo ""
echo "  Eenmalig in Play Console (handmatig):"
echo "    1) https://play.google.com/console → Users and permissions"
echo "    2) Invite user: $SA_EMAIL"
echo "    3) App $PLAY_PACKAGE → rechten: Release to production, exclude devices,"
echo "       Release to testing tracks, Manage store presence (min. Release manager)"
echo "    4) Account → API access: Cloud-project gekoppeld (zelfde project als de SA-JSON)"
echo ""
echo "  Optioneel naar Expo-servers uploaden (voor cloud --auto-submit):"
echo "    npx eas-cli credentials -p android"
echo "    → production → Google Service Account → Set up → pad naar JSON"
echo "  Met --local + serviceAccountKeyPath in eas.json is lokale submit genoeg."
echo ""
echo "  Bestaande lokale AAB opnieuw submitten (zonder rebuild):"
echo "    npx eas-cli submit --platform android --profile production \\"
echo "      --path build-<versionCode>-android.aab --non-interactive"
echo ""

# ── iOS / ASC ───────────────────────────────────────────────────────────────
echo "▶ iOS (App Store Connect / TestFlight)"
ASC_P8="$(ls "$ROOT"/secrets/AuthKey_*.p8 2>/dev/null | head -1 || true)"
if [[ -n "${ASC_P8:-}" ]]; then
  echo "  ✓ ASC API key file: secrets/$(basename "$ASC_P8")"
  if [[ -n "${ASC_API_KEY_ID:-}" && -n "${ASC_API_KEY_ISSUER_ID:-}" ]]; then
    echo "  ✓ ASC_API_KEY_ID / ASC_API_KEY_ISSUER_ID in omgeving"
  else
    echo "  ! Zet in .env (niet committen):"
    echo "      ASC_API_KEY_ID=XXXXXXXXXX"
    echo "      ASC_API_KEY_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    echo "    En vul die in eas.json submit.ios (ascApiKeyId / ascApiKeyIssuerId / ascApiKeyPath)"
  fi
else
  echo "  ○ Nog geen AuthKey_*.p8 in secrets/ (optioneel)"
  echo "    TestFlight werkt nu vaak al via Expo Apple-login (eas credentials)."
  echo "    Voor volledige non-interactive CI:"
  echo "      1) App Store Connect → Users and Access → Integrations → App Store Connect API"
  echo "      2) Generate API Key (App Manager of Admin)"
  echo "      3) Download AuthKey_XXXXX.p8 → secrets/ (gitignore)"
  echo "      4) Note Key ID + Issuer ID → .env + eas.json submit.ios"
fi

echo ""
echo "▶ Verify"
echo "  Play JSON readable: $([[ -f "$SA_JSON" ]] && echo yes || echo no)"
echo "  secrets/ in .gitignore: $(git check-ignore -q secrets/ && echo yes || echo NO)"
echo ""

if [[ "$ok" -eq 1 ]]; then
  echo "Lokaal klaar om te proberen:"
  echo "  npm run deploy:android"
  echo "  (of: npx eas-cli submit -p android --latest --profile production)"
  echo ""
  echo "Als submit faalt met permission denied: SA nog niet uitgenodigd in Play Console."
  exit 0
else
  echo "Nog niet compleet — zie ✗ hierboven."
  exit 1
fi
