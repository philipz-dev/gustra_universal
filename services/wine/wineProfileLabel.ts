import type { WineLabelFiche } from '@/data/types';
import {
  normalizeWineTypeStyle,
  wineProfileLabelI18nKey,
  wineProfileTypeCode,
  wineSweetnessBandFromScore,
  type WineProfileTypeCode,
  type WineSweetnessBand,
} from '@/services/wine/wineTypeStyle';

export type WineProfileParts = {
  type: WineProfileTypeCode;
  band: WineSweetnessBand;
  i18nKey: string;
};

export type WineProfileChipColors = {
  background: string;
  foreground: string;
};

/** Soft type tints for the profile chip (cream house, not neon). */
export function wineProfileChipColors(
  type: WineProfileTypeCode,
): WineProfileChipColors {
  switch (type) {
    case 'red':
      return { background: 'rgba(122, 40, 48, 0.14)', foreground: '#6B2A32' };
    case 'white':
      return { background: 'rgba(184, 150, 55, 0.2)', foreground: '#6F5A1C' };
    case 'rose':
      return { background: 'rgba(180, 100, 120, 0.16)', foreground: '#8B4558' };
    case 'sparkling':
      return { background: 'rgba(184, 150, 70, 0.22)', foreground: '#7A6220' };
    case 'fortified':
      return { background: 'rgba(100, 60, 40, 0.16)', foreground: '#5C3A28' };
    case 'orange':
      return { background: 'rgba(190, 115, 45, 0.18)', foreground: '#8B5520' };
  }
}

function sweetnessScore(
  fiche: WineLabelFiche | null | undefined,
): number | null {
  const trait = fiche?.tastingTraits?.find((t) => t.key === 'sweetness');
  if (!trait) return null;
  const n = Math.round(trait.score);
  return n >= 1 && n <= 5 ? n : null;
}

/**
 * Resolve type × sweetness for the chip.
 * Always returns a label for any wine fiche (defaults: white + dry;
 * legacy `dessert` → white + sweet when sweetness is missing).
 */
export function resolveWineProfileParts(
  fiche: WineLabelFiche | null | undefined,
): WineProfileParts {
  const code = normalizeWineTypeStyle(fiche?.typeStyle);
  const type = wineProfileTypeCode(code);
  const sweetness = sweetnessScore(fiche);
  const defaultBand: WineSweetnessBand =
    code === 'dessert' && sweetness == null ? 'sweet' : 'dry';
  const band =
    sweetness != null
      ? wineSweetnessBandFromScore(sweetness)
      : defaultBand;
  return {
    type,
    band,
    i18nKey: wineProfileLabelI18nKey(type, band),
  };
}
