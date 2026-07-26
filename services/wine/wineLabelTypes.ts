import type { WineLabelFiche } from '@/data/types';

export type { WineLabelFiche };

/** True when the fiche is worth showing (has a name). */
export function hasWineLabelMatch(
  fiche: WineLabelFiche | null | undefined,
): fiche is WineLabelFiche {
  return Boolean(fiche?.nameAndEstate?.trim());
}

/** One-line summary for the Drinks comment. */
export function formatWineLabelDrinksComment(fiche: WineLabelFiche): string {
  const parts = [
    fiche.nameAndEstate.trim(),
    fiche.typeStyle?.trim(),
    fiche.countryRegion?.trim(),
    fiche.vintage?.trim(),
    fiche.grapes?.trim(),
    fiche.alcoholPercent != null && Number.isFinite(fiche.alcoholPercent)
      ? `${fiche.alcoholPercent}%`
      : '',
  ].filter(Boolean);
  return parts.join(' · ');
}
