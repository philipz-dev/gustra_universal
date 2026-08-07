import type { CriterionRating, Review, WineLabelFiche } from '@/data/types';
import { RatingValue } from '@/services/reviews/ratings';
import { hasWineUserRating, wineLabelsForReview } from '@/services/wine/wineLabelTypes';

export type DraftReviewReason = 'criteria' | 'wine';

/**
 * A completed review needs at least one criterion with a star rating —
 * it doesn't matter which one (Food, Service, Setting, …).
 */
export function hasAnyRatedCriterion(criteria: CriterionRating[]): boolean {
  return criteria.some((criterion) =>
    RatingValue.isStarRating(criterion.rating),
  );
}

/**
 * A review is a draft when:
 * - no criterion has a star rating, or
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
  if (!hasAnyRatedCriterion(review.criteria ?? [])) return 'criteria';
  const wines = wineLabelsForReview(review);
  if (wines.some((w) => !hasWineUserRating(w))) return 'wine';
  return null;
}

/** Form-state variant (criteria list + wine fiches). */
export function isFormDraft(
  criteria: CriterionRating[],
  wines: WineLabelFiche[],
): boolean {
  if (!hasAnyRatedCriterion(criteria)) return true;
  if (wines.some((w) => !hasWineUserRating(w))) return true;
  return false;
}

export function formDraftReason(
  criteria: CriterionRating[],
  wines: WineLabelFiche[],
): DraftReviewReason | null {
  if (!hasAnyRatedCriterion(criteria)) return 'criteria';
  if (wines.some((w) => !hasWineUserRating(w))) return 'wine';
  return null;
}

/**
 * Most recent visit date (ISO) including the visit being filled in right now.
 *
 * `priorVisits` is newest-first but excludes the current review (by id). When
 * the date being entered is newer than the stored most recent visit, the label
 * "Meest recente bezoek" would be wrong the moment a newer visit is saved — so
 * compare and return the newer of the two.
 */
export function mostRecentVisitIso(
  priorVisits: readonly { date: string }[],
  currentVisitIso: string,
): string {
  if (priorVisits.length === 0) return currentVisitIso;
  const newestPrior = priorVisits[0]!.date;
  return currentVisitIso <= newestPrior ? newestPrior : currentVisitIso;
}

/** True when rating steps are a real star value (for wine checks). */
export function wineNeedsRating(fiche: WineLabelFiche): boolean {
  return !RatingValue.isStarRating(fiche.userRating ?? RatingValue.unrated);
}
