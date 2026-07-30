#!/usr/bin/env bash
# Standalone Gemini API test (not part of the app runtime).
# Loads EXPO_PUBLIC_GEMINI_API_KEY from a .env file and calls generateContent.
#
# Usage:
#   bash scripts/test-gemini.sh                          # text-only smoke test
#   bash scripts/test-gemini.sh --image ~/Desktop/wine.jpg   # Vision wine-label test
#   bash scripts/test-gemini.sh --env /path/to/.env --image ./label.jpg
#   GEMINI_MODEL=gemini-3.5-flash bash scripts/test-gemini.sh --image ./label.jpg
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
IMAGE_PATH=""

usage() {
  cat <<'EOF'
Usage: bash scripts/test-gemini.sh [options]

  --env PATH       .env file (default: repo .env)
  --image PATH     JPEG/PNG wine label photo → Vision JSON (same prompt as the app)
  -h, --help       Show help

Without --image: text-only "Reply with exactly: ok" smoke test.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --env=*)
      ENV_FILE="${1#*=}"
      shift
      ;;
    --image)
      IMAGE_PATH="${2:-}"
      shift 2
      ;;
    --image=*)
      IMAGE_PATH="${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      # Back-compat: bare path = .env
      if [[ -z "${IMAGE_PATH}" && -f "$1" && "$1" == *.env* ]]; then
        ENV_FILE="$1"
        shift
      elif [[ -z "${IMAGE_PATH}" && -f "$1" ]]; then
        # Bare image path convenience
        IMAGE_PATH="$1"
        shift
      else
        echo "Onbekende optie/pad: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "${ENV_FILE}" || ! -f "${ENV_FILE}" ]]; then
  echo "Env-bestand niet gevonden: ${ENV_FILE:-"(leeg)"}" >&2
  usage >&2
  exit 1
fi

if [[ -n "${IMAGE_PATH}" && ! -f "${IMAGE_PATH}" ]]; then
  echo "Afbeelding niet gevonden: $IMAGE_PATH" >&2
  exit 1
fi

KEY="$(
  python3 - <<'PY' "$ENV_FILE"
from pathlib import Path
import sys
path = Path(sys.argv[1])
for line in path.read_text(encoding="utf-8").splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    name, _, value = s.partition("=")
    if name.strip() == "EXPO_PUBLIC_GEMINI_API_KEY":
        print(value.strip().strip('"').strip("'"))
        break
PY
)"

if [[ -z "$KEY" ]]; then
  echo "EXPO_PUBLIC_GEMINI_API_KEY ontbreekt in $ENV_FILE" >&2
  exit 1
fi

if [[ "$KEY" == *"<snip>"* ]]; then
  echo "Key in $ENV_FILE lijkt geredacteerd (<snip>) — zet de echte key terug." >&2
  exit 1
fi

MODEL="${GEMINI_MODEL:-gemini-3.5-flash}"
URL="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}"

echo "Env:    $ENV_FILE"
echo "Model:  $MODEL"
echo "Key:    lengte ${#KEY}, prefix ${KEY:0:6}…"
if [[ -n "$IMAGE_PATH" ]]; then
  echo "Image:  $IMAGE_PATH"
  echo "Call:   generateContent (Vision wine-label — zwaardere test)"
else
  echo "Call:   generateContent (text-only smoke test)"
fi
echo ""

REQ_FILE="$(mktemp)"
BODY_FILE="$(mktemp)"
trap 'rm -f "$REQ_FILE" "$BODY_FILE"' EXIT

python3 - <<'PY' "$REQ_FILE" "${IMAGE_PATH:-}"
import base64, json, mimetypes, sys
from pathlib import Path

out_path = Path(sys.argv[1])
image_path = sys.argv[2].strip() if len(sys.argv) > 2 else ""

# Keep aligned with services/wine/identifyWineLabel.ts buildWineLabelPrompt('nl')
WINE_PROMPT = """This is a photo/scan of a wine bottle (or its label).
Identify the wine. Account for transparent bottles where text on the back may show through mirrored.
If you cannot confidently read a wine name/estate, return nameAndEstate as an empty string.

Language rules (one response language = Dutch):
- Write countryRegion and foodPairings in Dutch.
- Do NOT translate proper names from the label: nameAndEstate must match the bottle (faithful reading).
- grapeVarieties: JSON array of common ampelographic grape names (usually international). Use null when unknown.
- grapes: same varieties as a single comma-separated display string, or null.
- typeStyle: exactly one English code — red, white, rose, sparkling, fortified, orange. Required whenever you identify a wine. Champagne/Cava/Prosecco → sparkling. Port/Sherry/Madeira → fortified. Skin-contact amber → orange.

Also estimate sweetness whenever you identify a wine (required):
- Include tastingTraits with a single sweetness entry, integer score 1–5 (1 dry, 2–3 off-dry, 4–5 sweet).
- Do not include freshness, tannins, body, or acidity.
tastingTraits keys must stay English as shown.

Return STRICT JSON only (no markdown) with these keys:
{
  "nameAndEstate": "Wine name & winery/estate as on the label",
  "typeStyle": "red" | "white" | "rose" | "sparkling" | "fortified" | "orange",
  "countryRegion": "Country and region in Dutch",
  "vintage": "Harvest year on the bottle or null",
  "grapeVarieties": ["Grenache", "Syrah"] or null,
  "grapes": "Grenache, Syrah" or null,
  "alcoholPercent": number or null,
  "foodPairings": "Short food pairing phrase in Dutch, or null",
  "tastingTraits": [{ "key": "sweetness", "score": 1 }]
}"""

if image_path:
    raw = Path(image_path).read_bytes()
    # Cap ~4MB base64 payload; Gemini accepts larger but keep the test cheap.
    if len(raw) > 6_000_000:
        print(f"Waarschuwing: grote foto ({len(raw)} bytes). Overweeg een kleinere crop.", file=sys.stderr)
    mime, _ = mimetypes.guess_type(image_path)
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        # Default JPEG for HEIC/unknown — Gemini may reject; recommend jpg/png.
        if image_path.lower().endswith((".heic", ".heif")):
            raise SystemExit(
                "HEIC niet ondersteund in dit script. Exporteer als JPEG/PNG en probeer opnieuw."
            )
        mime = "image/jpeg"
    b64 = base64.b64encode(raw).decode("ascii")
    body = {
        "contents": [
            {
                "parts": [
                    {"text": WINE_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": b64}},
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    }
else:
    body = {
        "contents": [{"parts": [{"text": "Reply with exactly: ok"}]}],
    }

out_path.write_text(json.dumps(body), encoding="utf-8")
if image_path:
    print(f"Request: Vision JSON ({len(raw)} bytes image, mime={mime})", file=sys.stderr)
PY

HTTP_CODE="$(
  curl -sS -o "$BODY_FILE" -w "%{http_code}" \
    --max-time 120 \
    -X POST "$URL" \
    -H 'Content-Type: application/json' \
    --data-binary @"$REQ_FILE"
)"

echo "HTTP $HTTP_CODE"
python3 - <<'PY' "$BODY_FILE" "$HTTP_CODE" "${IMAGE_PATH:+vision}"
import json, sys, re

path, code = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "text"
raw = open(path, encoding="utf-8").read()
try:
    data = json.loads(raw) if raw.strip() else {}
except Exception:
    print(raw[:1000] or "(empty body)")
    sys.exit(1 if code != "200" else 0)

if code != "200":
    err = data.get("error") or data
    print(json.dumps(err, indent=2, ensure_ascii=False)[:1500])
    print("", file=sys.stderr)
    print("Gemini rejected the key/request. Check AI Studio / API enablement / billing.", file=sys.stderr)
    sys.exit(1)

text = (
    data.get("candidates", [{}])[0]
    .get("content", {})
    .get("parts", [{}])[0]
    .get("text", "")
)

if mode == "vision":
    print("OK — Vision antwoord ontvangen.")
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        fiche = json.loads(cleaned)
        print(json.dumps(fiche, indent=2, ensure_ascii=False))
        name = (fiche.get("nameAndEstate") or "").strip()
        if name:
            print(f"\nSamenvatting: {name}")
        else:
            print("\nSamenvatting: geen wijnnaam herkend (nameAndEstate leeg).")
    except Exception:
        print(text[:2000])
else:
    print("OK — model antwoord:", repr(text[:300]))
PY
