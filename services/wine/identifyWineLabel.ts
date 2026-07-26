import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { GeminiAPIConfig } from '@/constants/GeminiAPIConfig';
import { incrementGoogleApi } from '@/services/google/GoogleApiTracker';
import {
  formatWineLabelDrinksComment,
  type WineLabelFiche,
} from '@/services/wine/wineLabelTypes';

const MAX_SIDE = 1024;
const GEMINI_MODEL = 'gemini-2.0-flash';

const PROMPT = `This is a photo/scan of a wine bottle (or its label).
Identify the wine. Account for transparent bottles where text on the back may show through mirrored.
If you cannot confidently read a wine name/estate, return nameAndEstate as an empty string.

Return STRICT JSON only (no markdown) with these keys:
{
  "nameAndEstate": "Wine name & winery/estate (e.g. Love by Léoube)",
  "typeStyle": "one of: Rood, Wit, Rosé, Mousserend, Dessertwijn (use Dutch labels as shown, or closest)",
  "countryRegion": "Country and region (e.g. Frankrijk, Côtes de Provence)",
  "vintage": "Harvest year on the bottle or null",
  "grapes": "Grape variety/varieties or null",
  "alcoholPercent": number or null,
  "foodPairings": "Dishes this wine pairs well with, short phrase, or null"
}`;

type GeminiJson = {
  nameAndEstate?: unknown;
  typeStyle?: unknown;
  countryRegion?: unknown;
  vintage?: unknown;
  grapes?: unknown;
  alcoholPercent?: unknown;
  foodPairings?: unknown;
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

  return {
    labelPhotoUri,
    nameAndEstate,
    typeStyle: asNullableString(parsed.typeStyle) ?? undefined,
    countryRegion: asNullableString(parsed.countryRegion) ?? undefined,
    vintage: asNullableString(parsed.vintage),
    grapes: asNullableString(parsed.grapes),
    alcoholPercent: asAlcohol(parsed.alcoholPercent),
    foodPairings: asNullableString(parsed.foodPairings),
    analyzedAt: new Date().toISOString(),
  };
}

export type IdentifyWineLabelResult = {
  fiche: WineLabelFiche | null;
  drinksComment: string;
  /** Optimized JPEG used for the API (also good as label photo). */
  optimizedUri: string;
};

/**
 * One Gemini Vision call per invocation. Returns null fiche when no match.
 */
export async function identifyWineLabel(
  sourceUri: string,
): Promise<IdentifyWineLabelResult> {
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
          { text: PROMPT },
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

  const fiche = parseFicheJson(text, optimizedUri);
  return {
    fiche,
    drinksComment: fiche ? formatWineLabelDrinksComment(fiche) : '',
    optimizedUri,
  };
}
