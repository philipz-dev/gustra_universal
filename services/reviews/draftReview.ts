import type { CriterionRating, Review, WineLabelFiche } from '@/data/types';
import { hasStarRating, RatingValue } from '@/services/reviews/ratings';
import { hasWineUserRating, wineLabelsForReview } from '@/services/wine/wineLabelTypes';

export type DraftReviewReason = 'criteria' | 'wine';

/**
 * A review is a draft when:
 * - no restaurant criterion has stars, or
 * - at least one attached wine is missing a star rating.
 *
 * Computed (not stored) — backwards compatible with all prior data.
 */
export function isReviewDraft(
  review: Pick<Review, 'criteria' | 'wineLabel' | 'wineLabels'> | null | undefined,
): boolean {
  if (!review) return true;
  return draftReviewReason(review) != null;
}

/** Why the review is still a draft, or null when complete. */
export function draftReviewReason(
  review: Pick<Review, 'criteria' | 'wineLabel' | 'wineLabels'> | null | undefined,
): DraftReviewReason | null {
  if (!review) return 'criteria';
  if (!hasStarRating(review.criteria ?? [])) return 'criteria';
  const wines = wineLabelsForReview(review);
  if (wines.some((w) => !hasWineUserRating(w))) return 'wine';
  return null;
}

/** Form-state variant (criteria list + wine fiches). */
export function isFormDraft(
  criteria: CriterionRating[],
  wines: WineLabelFiche[],
): boolean {
  if (!hasStarRating(criteria)) return true;
  if (wines.some((w) => !hasWineUserRating(w))) return true;
  return false;
}

export function formDraftReason(
  criteria: CriterionRating[],
  wines: WineLabelFiche[],
): DraftReviewReason | null {
  if (!hasStarRating(criteria)) return 'criteria';
  if (wines.some((w) => !hasWineUserRating(w))) return 'wine';
  return null;
}

/** True when rating steps are a real star value (for wine checks). */
export function wineNeedsRating(fiche: WineLabelFiche): boolean {
  return !RatingValue.isStarRating(fiche.userRating ?? RatingValue.unrated);
}
