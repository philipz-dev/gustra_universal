import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { GeminiAPIConfig } from '@/constants/GeminiAPIConfig';
import type { AppLanguage } from '@/i18n/resolveLanguage';
import { resolveAppLanguage } from '@/i18n/resolveLanguage';
import { assertGoogleApiAllowed } from '@/services/google/GoogleApiQuota';
import { incrementGoogleApi } from '@/services/google/GoogleApiTracker';
import { parseGrapeVarieties } from '@/services/wine/wineGrapeVarieties';
import {
  formatWineLabelDrinksComment,
  type WineLabelFiche,
} from '@/services/wine/wineLabelTypes';
import { normalizeVintageYear } from '@/services/wine/parseWineLabelOcr';
import { parseTasteProfileConfidence } from '@/services/wine/wineTasteProfile';
import { parseTastingTraits } from '@/services/wine/wineTastingTraits';
import { normalizeWineTypeStyle } from '@/services/wine/wineTypeStyle';
import { extractTextFromImage } from '@/services/ocr/OCRService';

const MAX_SIDE = 1024;
const GEMINI_MODEL = 'gemini-3.5-flash';

const LANGUAGE_PROMPT_NAME: Record<AppLanguage, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  nl: 'Dutch',
};

function wineFicheJsonContract(lang: string): string {
  return `Language rules (one response language = ${lang}):
- Write countryRegion and foodPairings in ${lang}.
- Do NOT translate proper wine/estate names: nameAndEstate must stay faithful.
- grapeVarieties: JSON array of common ampelographic grape names (usually international, e.g. "Grenache", "Syrah"). Use null when unknown.
- grapes: same varieties as a single comma-separated display string, or null.
- typeStyle: exactly one English code — red, white, rose, sparkling, fortified, orange. Required whenever you identify a wine. Champagne/Cava/Prosecco → sparkling. Port/Sherry/Madeira → fortified. Skin-contact amber → orange. Never a translated word.

Also estimate a taste profile when you can (same response — do not invent):
- tastingTraits: include only keys you can judge with reasonable confidence. Keys (English):
  body, tannins, acidity, sweetness — integer score 1–5.
  Omit tannins for white / sparkling / most rosés unless clearly relevant.
  Do NOT include freshness.
  sweetness is still required whenever you identify a wine (1 = dry … 5 = very sweet) for the style chip.
- grapeBlend: optional array of { "name": "Grenache", "percent": 60 }. Include percent ONLY when you know the cuvée blend with high confidence; otherwise omit percent or use grapeVarieties without %.
- grapeVarieties / grapes: still fill name lists for search/display.
- servingTempHint / aerationHint: short phrases in ${lang}, or null when unsure.
  Examples: "16–18 °C", "Open 30 min beforehand".
  Do NOT invent a drink-by / cellar-until date (omit any drink-window field).
- vintage: four-digit year starting with 19 or 20 (e.g. "1998", "2016"), or null. Never invent a year.
- tasteProfileConfidence: "high" | "medium" | "low" for the taste-profile block as a whole.
  Use "low" when the wine is obscure / ambiguous / you would mostly guess — the app will hide the profile.
  Identity fields (name, type, vintage) may still be filled when confidence is low.

Return STRICT JSON only (no markdown) with these keys:
{
  "nameAndEstate": "Wine name & winery/estate",
  "typeStyle": "red" | "white" | "rose" | "sparkling" | "fortified" | "orange",
  "countryRegion": "Country and region in ${lang}",
  "vintage": "1998" or "2016" or null,
  "grapeVarieties": ["Grenache", "Syrah"] or null,
  "grapeBlend": [{"name": "Grenache", "percent": 60}, {"name": "Syrah"}] or null,
  "grapes": "Grenache, Syrah" or null,
  "alcoholPercent": number or null,
  "foodPairings": "Short food pairing phrase in ${lang}, or null",
  "tastingTraits": [
    { "key": "body", "score": 4 },
    { "key": "tannins", "score": 3 },
    { "key": "acidity", "score": 4 },
    { "key": "sweetness", "score": 1 }
  ],
  "servingTempHint": "16–18 °C" or null,
  "aerationHint": "Decant 1 hour" or null,
  "tasteProfileConfidence": "high" | "medium" | "low"
}`;
}

/** Shared with `scripts/test-gemini.sh` (keep in sync). */
export function buildWineLabelPrompt(language: AppLanguage): string {
  const lang = LANGUAGE_PROMPT_NAME[language];
  return `This is a photo/scan of a wine bottle (or its label).
Identify the wine. Account for transparent bottles where text on the back may show through mirrored.
If you cannot confidently read a wine name/estate, return nameAndEstate as an empty string.
- vintage: REQUIRED whenever a harvest year is visible on the label. Never invent. If no year is readable, return null.

${wineFicheJsonContract(lang)}`;
}

export type IdentifyWineByTextInput = {
  /** Wine / cuvée name (required). */
  name: string;
  /** Estate / domaine / château (strongly recommended). */
  estate?: string;
  /** Harvest year, e.g. "2016" (strongly recommended). */
  vintage?: string;
};

/** Text lookup — same JSON fiche as Vision, without a photo. */
export function buildWineTextPrompt(
  language: AppLanguage,
  input: IdentifyWineByTextInput,
): string {
  const lang = LANGUAGE_PROMPT_NAME[language];
  const name = input.name.trim();
  const estate = input.estate?.trim() ?? '';
  const vintage = normalizeVintageYear(input.vintage?.trim() ?? null) ?? '';
  const lines = [
    `Wine name: ${name}`,
    estate ? `Estate / domaine / winery: ${estate}` : null,
    vintage ? `Vintage year (user-provided — use this; do not invent another): ${vintage}` : null,
  ].filter(Boolean);

  return `Identify this wine from the user's description (no photo).
If the name is too ambiguous to match a real wine confidently, return nameAndEstate as an empty string.
Prefer the user's estate/domaine and vintage when provided.
When estate or vintage is missing, lower tasteProfileConfidence (often "medium" or "low") and do not invent a vintage.
Compose nameAndEstate as the wine name with estate when known (as on a typical label).

User input:
${lines.join('\n')}

${wineFicheJsonContract(lang)}`;
}

type GeminiJson = {
  nameAndEstate?: unknown;
  typeStyle?: unknown;
  countryRegion?: unknown;
  vintage?: unknown;
  grapes?: unknown;
  grapeVarieties?: unknown;
  grapeBlend?: unknown;
  alcoholPercent?: unknown;
  foodPairings?: unknown;
  tastingTraits?: unknown;
  servingTempHint?: unknown;
  aerationHint?: unknown;
  tasteProfileConfidence?: unknown;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

/** Downscale + JPEG compress so one Vision call stays small/cheap. */
export async function optimizeWineLabelForUpload(uri: string): Promise<string> {
  let actions: ImageManipulator.Action[] = [];
  try {
    const { width, height } = await getImageSize(uri);
    const longest = Math.max(width, height);
    if (longest > MAX_SIDE && longest > 0) {
      const scale = MAX_SIDE / longest;
      actions = [
        {
          resize: {
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
          },
        },
      ];
    }
  } catch {
    actions = [{ resize: { width: MAX_SIDE } }];
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

function asTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asNullableString(value: unknown): string | null {
  const s = asTrimmedString(value);
  if (!s || /^null$/i.test(s) || s === '-' || s === 'n/a') return null;
  return s;
}

function asAlcohol(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 10) / 10;
  }
  if (typeof value === 'string') {
    const m = value.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const n = Number.parseFloat(m[1]!);
      return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
    }
  }
  return null;
}

function parseFicheJson(
  raw: string,
  labelPhotoUri: string,
): WineLabelFiche | null {
  let parsed: GeminiJson;
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned) as GeminiJson;
  } catch {
    return null;
  }

  const nameAndEstate = asTrimmedString(parsed.nameAndEstate);
  if (!nameAndEstate) return null;

  const tastingTraitsRaw = parseTastingTraits(parsed.tastingTraits);
  let typeCode = normalizeWineTypeStyle(parsed.typeStyle);
  // Every identified wine gets a stable type for the profile chip.
  if (!typeCode) typeCode = 'white';

  // Always persist sweetness (default dry) so the chip can resolve a band.
  const hasSweetness = tastingTraitsRaw?.some((t) => t.key === 'sweetness');
  const tastingTraits = hasSweetness
    ? tastingTraitsRaw
    : [
        ...(tastingTraitsRaw ?? []),
        { key: 'sweetness' as const, score: 1 },
      ];

  const legacyType = asNullableString(parsed.typeStyle);
  const { grapeVarieties, grapes, grapeBlend } = parseGrapeVarieties({
    grapeVarieties: parsed.grapeVarieties,
    grapes: parsed.grapes,
    grapeBlend: parsed.grapeBlend,
  });
  const tasteProfileConfidence = parseTasteProfileConfidence(
    parsed.tasteProfileConfidence,
  );
  const servingTempHint = asNullableString(parsed.servingTempHint);
  const aerationHint = asNullableString(parsed.aerationHint);
  const vintage = normalizeVintageYear(asNullableString(parsed.vintage));

  return {
    labelPhotoUri,
    nameAndEstate,
    typeStyle: typeCode ?? legacyType ?? 'white',
    countryRegion: asNullableString(parsed.countryRegion) ?? undefined,
    vintage,
    grapes,
    ...(grapeVarieties?.length ? { grapeVarieties } : {}),
    ...(grapeBlend?.length ? { grapeBlend } : {}),
    alcoholPercent: asAlcohol(parsed.alcoholPercent),
    foodPairings: asNullableString(parsed.foodPairings),
    tastingTraits,
    ...(servingTempHint ? { servingTempHint } : {}),
    ...(aerationHint ? { aerationHint } : {}),
    ...(tasteProfileConfidence ? { tasteProfileConfidence } : {}),
    analyzedAt: new Date().toISOString(),
  };
}

/** When Vision omits vintage, OCR the label for a 19xx/20xx year. */
async function enrichVintageFromOcr(
  fiche: WineLabelFiche,
  imageUri: string,
): Promise<WineLabelFiche> {
  if (normalizeVintageYear(fiche.vintage)) return fiche;
  try {
    const raw = await extractTextFromImage(imageUri, {
      collapseWhitespace: false,
    });
    const year = normalizeVintageYear(raw);
    if (!year) return fiche;
    return { ...fiche, vintage: year };
  } catch {
    return fiche;
  }
}

export type IdentifyWineLabelResult = {
  fiche: WineLabelFiche | null;
  drinksComment: string;
  /** Optimized JPEG used for the API (also good as label photo). */
  optimizedUri: string;
};

export type IdentifyWineLabelOptions = {
  /** Active app language (Settings or system). Defaults to resolved system language. */
  language?: AppLanguage;
  /** Localized type label for the drinks one-liner (e.g. "Rood"). */
  typeStyleLabel?: string;
};

/**
 * One Gemini Vision call per invocation. Returns null fiche when no match.
 * Human-readable fields follow `language`; typeStyle is a stable code.
 */
export async function identifyWineLabel(
  sourceUri: string,
  options?: IdentifyWineLabelOptions,
): Promise<IdentifyWineLabelResult> {
  await assertGoogleApiAllowed('gemini');

  const language = options?.language ?? resolveAppLanguage('system');
  const key = GeminiAPIConfig.requireApiKey();
  const optimizedUri = await optimizeWineLabelForUpload(sourceUri);
  const base64 = await FileSystem.readAsStringAsync(optimizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        parts: [
          { text: buildWineLabelPrompt(language) },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      errText.trim() || `Gemini request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim() ?? '';

  await incrementGoogleApi('gemini');

  let fiche = parseFicheJson(text, optimizedUri);
  if (fiche) {
    fiche = await enrichVintageFromOcr(fiche, optimizedUri);
  }
  return {
    fiche,
    drinksComment: fiche
      ? formatWineLabelDrinksComment(fiche, {
          typeStyleLabel: options?.typeStyleLabel,
        })
      : '',
    optimizedUri,
  };
}

export type IdentifyWineByTextResult = {
  fiche: WineLabelFiche | null;
  drinksComment: string;
};

/**
 * One Gemini text call — same fiche shape as Vision (no label photo).
 */
export async function identifyWineByText(
  input: IdentifyWineByTextInput,
  options?: IdentifyWineLabelOptions,
): Promise<IdentifyWineByTextResult> {
  await assertGoogleApiAllowed('gemini');

  const name = input.name.trim();
  if (!name) {
    return { fiche: null, drinksComment: '' };
  }

  const language = options?.language ?? resolveAppLanguage('system');
  const key = GeminiAPIConfig.requireApiKey();
  const userVintage = normalizeVintageYear(input.vintage?.trim() ?? null);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        parts: [{ text: buildWineTextPrompt(language, { ...input, name }) }],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      errText.trim() || `Gemini request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim() ?? '';

  await incrementGoogleApi('gemini');

  let fiche = parseFicheJson(text, '');
  if (fiche && userVintage && !normalizeVintageYear(fiche.vintage)) {
    fiche = { ...fiche, vintage: userVintage };
  }

  return {
    fiche,
    drinksComment: fiche
      ? formatWineLabelDrinksComment(fiche, {
          typeStyleLabel: options?.typeStyleLabel,
        })
      : '',
  };
}
