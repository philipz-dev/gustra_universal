/** Stable Vision codes — localized via profile labels (`wineScan.fiche.profileLabels.*`). */
export type WineTypeStyleCode =
  | 'red'
  | 'white'
  | 'rose'
  | 'sparkling'
  | 'fortified'
  | 'orange'
  /** @deprecated Prefer fortified / white+sweet; kept for dual-read of older scans. */
  | 'dessert';

/** Types used in the type × sweetness chip matrix (table). */
export type WineProfileTypeCode =
  | 'red'
  | 'white'
  | 'rose'
  | 'sparkling'
  | 'fortified'
  | 'orange';

/** Three-band sweetness for the profile chip. */
export type WineSweetnessBand = 'dry' | 'offDry' | 'sweet';

export const WINE_TYPE_STYLE_CODES: readonly WineTypeStyleCode[] = [
  'red',
  'white',
  'rose',
  'sparkling',
  'fortified',
  'orange',
  'dessert',
] as const;

export const WINE_PROFILE_TYPE_CODES: readonly WineProfileTypeCode[] = [
  'red',
  'white',
  'rose',
  'sparkling',
  'fortified',
  'orange',
] as const;

const CODE_SET = new Set<string>(WINE_TYPE_STYLE_CODES);
const PROFILE_SET = new Set<string>(WINE_PROFILE_TYPE_CODES);

/** Legacy free-text labels from older scans → stable code. */
const LEGACY_TYPE_ALIASES: Record<string, WineTypeStyleCode> = {
  red: 'red',
  rood: 'red',
  rouge: 'red',
  rot: 'red',
  rosso: 'red',
  tinto: 'red',
  white: 'white',
  wit: 'white',
  blanc: 'white',
  bianco: 'white',
  blanco: 'white',
  weiß: 'white',
  weiss: 'white',
  rose: 'rose',
  rosé: 'rose',
  rosado: 'rose',
  rosato: 'rose',
  sparkling: 'sparkling',
  mousserend: 'sparkling',
  mousseux: 'sparkling',
  schaumwein: 'sparkling',
  spumante: 'sparkling',
  espumoso: 'sparkling',
  champagne: 'sparkling',
  cava: 'sparkling',
  prosecco: 'sparkling',
  fortified: 'fortified',
  versterkt: 'fortified',
  muté: 'fortified',
  mute: 'fortified',
  generoso: 'fortified',
  port: 'fortified',
  porto: 'fortified',
  sherry: 'fortified',
  madeira: 'fortified',
  orange: 'orange',
  oranje: 'orange',
  amber: 'orange',
  skincontact: 'orange',
  dessert: 'dessert',
  dessertwijn: 'dessert',
  dessertwein: 'dessert',
  'vin doux': 'dessert',
  'vino dolce': 'dessert',
  'vino dulce': 'dessert',
};

export function isWineTypeStyleCode(
  value: unknown,
): value is WineTypeStyleCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

export function isWineProfileTypeCode(
  value: unknown,
): value is WineProfileTypeCode {
  return typeof value === 'string' && PROFILE_SET.has(value);
}

/**
 * Normalize Vision / legacy `typeStyle` to a stable code.
 * Unknown free text → undefined (caller may still show the raw string).
 */
export function normalizeWineTypeStyle(
  raw: unknown,
): WineTypeStyleCode | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (isWineTypeStyleCode(trimmed)) return trimmed;

  const key = trimmed.toLowerCase().normalize('NFC');
  if (LEGACY_TYPE_ALIASES[key]) return LEGACY_TYPE_ALIASES[key];

  // "Red wine", "Vin rouge", etc.
  for (const [alias, code] of Object.entries(LEGACY_TYPE_ALIASES)) {
    if (key === alias || key.startsWith(`${alias} `) || key.includes(` ${alias}`)) {
      return code;
    }
  }
  return undefined;
}

/** Map stored type → matrix row (dessert wines → white + usually sweet). */
export function wineProfileTypeCode(
  code: WineTypeStyleCode | undefined,
): WineProfileTypeCode {
  if (code === 'dessert') return 'white';
  if (code && isWineProfileTypeCode(code)) return code;
  return 'white';
}

/**
 * Map Vision sweetness 1–5 → 3 bands.
 * 1 = dry, 2–3 = off-dry, 4–5 = sweet.
 */
export function wineSweetnessBandFromScore(
  score: number | null | undefined,
): WineSweetnessBand {
  if (score == null || !Number.isFinite(score)) return 'dry';
  const n = Math.round(score);
  if (n <= 1) return 'dry';
  if (n <= 3) return 'offDry';
  return 'sweet';
}

/** @deprecated Short type-only keys; prefer `wineProfileLabelI18nKey`. */
export function wineTypeStyleI18nKey(code: WineTypeStyleCode): string {
  return `wineScan.fiche.typeStyles.${code}`;
}

export function wineProfileLabelI18nKey(
  type: WineProfileTypeCode,
  band: WineSweetnessBand,
): string {
  return `wineScan.fiche.profileLabels.${type}.${band}`;
}
