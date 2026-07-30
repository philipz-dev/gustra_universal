import type { Review, WineLabelFiche, WineTastingTraitKey } from '@/data/types';
import { RatingValue } from '@/services/reviews/ratings';
import { wineLabelGrapeList } from '@/services/wine/wineGrapeVarieties';
import { normalizeWineTypeStyle } from '@/services/wine/wineTypeStyle';

export type { WineLabelFiche };

/** True when the fiche is worth showing (has a name). */
export function hasWineLabelMatch(
  fiche: WineLabelFiche | null | undefined,
): fiche is WineLabelFiche {
  return Boolean(fiche?.nameAndEstate?.trim());
}

/** True when the user rated this bottle (required for new scans). */
export function hasWineUserRating(
  fiche: WineLabelFiche | null | undefined,
): boolean {
  return RatingValue.isStarRating(fiche?.userRating ?? RatingValue.unrated);
}

/**
 * Average of per-wine `userRating` values as half-star steps (1…10).
 * Null when no wine has a star rating yet.
 */
export function averageWineUserRating(
  wines: WineLabelFiche[] | null | undefined,
): number | null {
  if (!wines?.length) return null;
  const rated = wines
    .map((w) => w.userRating)
    .filter((r): r is number => RatingValue.isStarRating(r ?? 0));
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((a, b) => a + b, 0) / rated.length);
}

/**
 * Resolve ordered wines for a review (dual-read: `wineLabels` → `wineLabel`).
 */
export function wineLabelsForReview(
  review:
    | Pick<Review, 'wineLabel' | 'wineLabels'>
    | null
    | undefined,
): WineLabelFiche[] {
  if (!review) return [];
  if (Array.isArray(review.wineLabels) && review.wineLabels.length > 0) {
    return review.wineLabels.filter(hasWineLabelMatch);
  }
  return hasWineLabelMatch(review.wineLabel) ? [review.wineLabel] : [];
}

/**
 * Dual-write fields: primary `wineLabel` (compat) + full `wineLabels` list.
 */
export function syncWineLabelFields(list: WineLabelFiche[]): {
  wineLabel: WineLabelFiche | null;
  wineLabels: WineLabelFiche[] | undefined;
} {
  const cleaned = list.filter(hasWineLabelMatch);
  if (cleaned.length === 0) {
    return { wineLabel: null, wineLabels: undefined };
  }
  return { wineLabel: cleaned[0] ?? null, wineLabels: cleaned };
}

/**
 * Legacy one-liner dumped into Drinks before identity lived on `wineLabel`
 * (e.g. "Love by Léoube · Rosé · France · …").
 */
export function isLegacyStuffedDrinksComment(
  comment: string,
  fiche: WineLabelFiche | null | undefined | WineLabelFiche[],
): boolean {
  const list = Array.isArray(fiche)
    ? fiche.filter(hasWineLabelMatch)
    : hasWineLabelMatch(fiche)
      ? [fiche]
      : [];
  if (list.length === 0) return false;
  const trimmed = comment.trim();
  if (!trimmed) return false;
  return list.some((item) => {
    const name = item.nameAndEstate.trim();
    if (!name) return false;
    if (trimmed === formatWineLabelDrinksComment(item)) return true;
    if (trimmed.startsWith(`${name} · `)) return true;
    return false;
  });
}

/** User-facing Drinks notes — hides legacy stuffed identity one-liners.
 * Do not trim: controlled TextInputs must keep leading/trailing spaces while typing.
 */
export function drinksCommentForDisplay(
  comment: string,
  fiche?: WineLabelFiche | null | WineLabelFiche[],
): string {
  if (isLegacyStuffedDrinksComment(comment, fiche)) return '';
  return comment;
}

/**
 * Compact summary (search / OCR index). Prefer structured `wineLabel` in UI.
 * @deprecated Identity belongs on the wine card, not in the Drinks comment.
 */
export function formatWineLabelDrinksComment(
  fiche: WineLabelFiche,
  options?: { typeStyleLabel?: string },
): string {
  const typeRaw = fiche.typeStyle?.trim() ?? '';
  const typePart =
    options?.typeStyleLabel?.trim() ||
    normalizeWineTypeStyle(typeRaw) ||
    typeRaw;
  const grapes =
    fiche.grapes?.trim() ||
    wineLabelGrapeList(fiche).join(', ') ||
    '';
  const parts = [
    fiche.nameAndEstate.trim(),
    typePart,
    fiche.countryRegion?.trim(),
    fiche.vintage?.trim(),
    grapes,
    fiche.alcoholPercent != null && Number.isFinite(fiche.alcoholPercent)
      ? `${fiche.alcoholPercent}%`
      : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/** Tasting score 1–5 for filter queries; null when absent. */
export function wineLabelTraitScore(
  fiche: WineLabelFiche | null | undefined,
  key: WineTastingTraitKey,
): number | null {
  const trait = fiche?.tastingTraits?.find((t) => t.key === key);
  if (!trait) return null;
  const n = Math.round(trait.score);
  return n >= 1 && n <= 5 ? n : null;
}
