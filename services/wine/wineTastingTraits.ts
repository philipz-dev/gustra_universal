import type { WineTastingTrait, WineTastingTraitKey } from '@/data/types';

/** All keys we may dual-read (incl. legacy freshness). */
export const WINE_TASTING_TRAIT_KEYS: WineTastingTraitKey[] = [
  'freshness',
  'tannins',
  'body',
  'acidity',
  'sweetness',
];

/**
 * Scales shown in Smaakprofiel (Gustra order — not Vivino).
 * No freshness (overlap with acidity).
 */
export const WINE_TASTE_PROFILE_TRAIT_KEYS: WineTastingTraitKey[] = [
  'body',
  'tannins',
  'acidity',
  'sweetness',
];

const KEY_SET = new Set<string>(WINE_TASTING_TRAIT_KEYS);
const PROFILE_KEY_SET = new Set<string>(WINE_TASTE_PROFILE_TRAIT_KEYS);

export function isWineTastingTraitKey(value: unknown): value is WineTastingTraitKey {
  return typeof value === 'string' && KEY_SET.has(value);
}

export function isWineTasteProfileTraitKey(
  value: unknown,
): value is WineTastingTraitKey {
  return typeof value === 'string' && PROFILE_KEY_SET.has(value);
}

/** Clamp/normalize a Vision score to 1…5, or null if unusable. */
export function normalizeTraitScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 5) return n;
    return null;
  }
  if (typeof value === 'string') {
    const m = value.trim().match(/^([1-5])(?:\.0+)?$/);
    if (m) return Number.parseInt(m[1]!, 10);
  }
  return null;
}

/**
 * Parse Vision `tastingTraits` array. Unknown keys / bad scores skipped.
 * Preserves canonical store order (incl. legacy freshness if present).
 */
export function parseTastingTraits(raw: unknown): WineTastingTrait[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const byKey = new Map<WineTastingTraitKey, number>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const keyRaw = rec.key ?? rec.id ?? rec.name;
    if (!isWineTastingTraitKey(keyRaw)) continue;
    const score = normalizeTraitScore(rec.score ?? rec.value ?? rec.rating);
    if (score == null) continue;
    byKey.set(keyRaw, score);
  }
  if (byKey.size === 0) return undefined;
  return WINE_TASTING_TRAIT_KEYS.filter((k) => byKey.has(k)).map((key) => ({
    key,
    score: byKey.get(key)!,
  }));
}

/** Traits for the Smaakprofiel UI (no freshness). */
export function tasteProfileTraits(
  traits: WineTastingTrait[] | null | undefined,
): WineTastingTrait[] {
  if (!traits?.length) return [];
  const byKey = new Map(traits.map((t) => [t.key, t.score] as const));
  return WINE_TASTE_PROFILE_TRAIT_KEYS.filter((k) => byKey.has(k)).map(
    (key) => ({ key, score: byKey.get(key)! }),
  );
}

export function hasTastingTraits(
  traits: WineTastingTrait[] | null | undefined,
): traits is WineTastingTrait[] {
  return Boolean(traits && traits.length > 0);
}
