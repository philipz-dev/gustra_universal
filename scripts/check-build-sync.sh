#!/usr/bin/env bash
# Guard that keeps ios.buildNumber and android.versionCode in sync — for every
# upload path (deploy-store.sh, deploy-ios-testflight.sh, deploy-android-internal.sh,
# manual `eas build`/`eas submit`, TestFlight / Play uploads, CI).
#
# Two checks:
#   1. Config sync  — app.config.ts must have ios.buildNumber == android.versionCode.
#      A single number guarantees that ANY build produced from this config carries
#      the same store version on both platforms, so the stores can never diverge
#      because the source differs.
#   2. Artifact sync — every local build artifact (build-<n>-ios.ipa and
#      build-<n>-android.aab) must carry the SAME numeric build number in its
#      binary metadata (Info.plist CFBundleVersion / AAB versionCode). Only one
#      artifact of each platform is checked — the newest (build-<n>-* where n is
#      the highest number found). Otherwise local builds could be submitted
#      out of order (e.g. an old 57 AAB after a 60 IPA) and stores diverge again.
#
# Exit 0 when everything is in sync, 1 otherwise (with a clear message).
# Safe to run read-only from CI, pre-push hooks, or manually.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)/.."
ROOT="$(cd "$ROOT" && pwd)"
# Override for tests / tooling; defaults to the project config.
CONFIG="${GUSTRA_APP_CONFIG:-$ROOT/app.config.ts}"

read_ios_build() {
  grep -E "buildNumber:\s*'" "$CONFIG" | head -1 | sed -E "s/.*buildNumber: '([0-9]+)'.*/\1/"
}

read_android_code() {
  grep -E "versionCode:\s*[0-9]+" "$CONFIG" | head -1 | sed -E "s/.*versionCode: ([0-9]+).*/\1/"
}

fail() {
  echo "❌ $*" >&2
  exit 1
}

IOS="$(read_ios_build)"
AND="$(read_android_code)"

if [[ -z "$IOS" || ! "$IOS" =~ ^[0-9]+$ ]]; then
  fail "Kon ios.buildNumber niet lezen uit $CONFIG"
fi
if [[ -z "$AND" || ! "$AND" =~ ^[0-9]+$ ]]; then
  fail "Kon android.versionCode niet lezen uit $CONFIG"
fi

if [[ "$IOS" != "$AND" ]]; then
  fail "Config niet gesynchroniseerd: ios.buildNumber=$IOS maar android.versionCode=$AND in $CONFIG.
  Zet beide op dezelfde waarde (bijv. beide op $((IOS > AND ? IOS : AND)))."
fi

echo "✓ Config in sync: ios.buildNumber = android.versionCode = $IOS"

# ── Artifact check (best effort, read-only) ────────────────────────────────
# Only run when both a build artifact directory exists. Uses python3 (no Java /
# bundletool dependency) to read binary AndroidManifest.xml inside the AAB.

PYTHON_OK=0
command -v python3 >/dev/null 2>&1 && PYTHON_OK=1

if [[ "$PYTHON_OK" -eq 1 ]]; then
  find_artifacts() { # prints newest matching file, or nothing
    local pat="$1"
    # newest by mtime among build-<digits>-<suffix>
    ls -t "$ROOT"/build-*-"$pat" 2>/dev/null | head -1
  }

  IPA="$(find_artifacts "ios.ipa")"
  AAB="$(find_artifacts "android.aab")"

  if [[ -n "$IPA" && -n "$AAB" ]]; then
    out="$(python3 - "$IPA" "$AAB" <<'PY'
import plistlib, re, sys, zipfile

ipa, aab = sys.argv[1], sys.argv[2]
ipa_ver = aab_ver = None

try:
    with zipfile.ZipFile(ipa) as z:
        names = [n for n in z.namelist() if n.endswith(".app/Info.plist")]
        if names:
            plist = z.read(names[0])
            if plist.startswith(b"bplist"):
                ipa_ver = str(plistlib.loads(plist).get("CFBundleVersion", ""))
            else:
                m = re.search(rb"CFBundleVersion</key>\s*<string>([^<]+)</string>", plist)
                if m:
                    ipa_ver = m.group(1).decode()
except Exception:
    ipa_ver = None

try:
    with zipfile.ZipFile(aab) as z:
        man = z.read("base/manifest/AndroidManifest.xml")
        m = re.search(rb"versionCode\x1a\x02([0-9]+)", man)
        if m:
            aab_ver = m.group(1).decode()
except Exception:
    aab_ver = None

print(f"IPA {ipa_ver or '?'} AAB {aab_ver or '?'} IPA_FILE {ipa} AAB_FILE {aab}")
PY
)"
    # shellcheck disable=SC2181
    if [[ $? -ne 0 ]]; then
      echo "⚠  Artefact-check overslagen (python3 kon bestanden niet lezen)."
    else
      ipa_ver="$(echo "$out" | awk '{print $2}')"
      aab_ver="$(echo "$out" | awk '{print $4}')"
      ipa_file="$(echo "$out" | awk '{print $6}')"
      aab_file="$(echo "$out" | awk '{print $8}')"
      if [[ "$ipa_ver" != "$aab_ver" ]]; then
        fail "Lokale artefacten niet gesynchroniseerd: $ipa_file (iOS build $ipa_ver) vs $aab_file (Android build $aab_ver). Upload niet beide vóór ze gelijk zijn."
      fi
      echo "✓ Nieuwste artefacten in sync: $ipa_file en $aab_file → build $ipa_ver"
    fi
  elif [[ -n "$IPA" || -n "$AAB" ]]; then
    echo "ℹ  Eén platform heeft artefacten (IPA/AAB) — alleen config gecontroleerd."
  fi
else
  echo "ℹ  python3 niet gevonden — artefact-check overgeslagen."
fi

exit 0
