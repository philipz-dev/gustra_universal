#!/usr/bin/env bash
# Bump ios.buildNumber, EAS production build + auto-submit (TestFlight), then commit the bump.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/app.config.ts"

cd "$ROOT"

current=$(grep -E "buildNumber:\s*'" "$CONFIG" | head -1 | sed -E "s/.*buildNumber: '([0-9]+)'.*/\1/")
if [[ -z "$current" || ! "$current" =~ ^[0-9]+$ ]]; then
  echo "Kon ios.buildNumber niet lezen uit app.config.ts" >&2
  exit 1
fi

next=$((current + 1))
sed -i '' -E "s/(buildNumber: ')${current}(')/\1${next}\2/" "$CONFIG"
echo "buildNumber: $current → $next"

cleanup_on_fail() {
  echo "Build/submit mislukt — buildNumber teruggezet naar $current" >&2
  sed -i '' -E "s/(buildNumber: ')${next}(')/\1${current}\2/" "$CONFIG"
}
trap cleanup_on_fail ERR

EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform ios --profile production --auto-submit --non-interactive

trap - ERR

git add app.config.ts
git commit -m "$(cat <<EOF
Bump iOS buildNumber to ${next} for TestFlight.

EOF
)"

echo "Klaar: build ${next} geüpload naar TestFlight; bump gecommit."
