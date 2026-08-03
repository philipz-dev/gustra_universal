import type { CriterionRating } from '@/data/types';
import { i18n } from '@/i18n';
import { mapLegacyCriterionId } from '@/context/CriteriaSettings';

/**
 * Rating storage in half-star steps (Swift `RatingValue`):
 * `0` = unrated, `-1` = N/A, `1…10` = half-stars (`2` = 1.0★, `7` = 3.5★, `10` = 5.0★).
 */
export const RatingValue = {
  notApplicable: -1,
  unrated: 0,
  maxSteps: 10,

  isNotApplicable(rating: number): boolean {
    return rating === this.notApplicable;
  },

  isStarRating(rating: number): boolean {
    return Number.isFinite(rating) && rating >= 1 && rating <= this.maxSteps;
  },

  isAnswered(rating: number): boolean {
    return this.isStarRating(rating) || this.isNotApplicable(rating);
  },

  /** Star value on a 0.5…5.0 scale. */
  starValue(rating: number): number {
    return rating / 2;
  },

  /** Fill amount (0 / 0.5 / 1) for star index 1…5. */
  fillForStar(starIndex: number, rating: number): number {
    if (!this.isStarRating(rating)) return 0;
    const full = starIndex * 2;
    const half = starIndex * 2 - 1;
    if (rating >= full) return 1;
    if (rating === half) return 0.5;
    return 0;
  },

  steps(forStar: number, half: boolean): number {
    return half ? forStar * 2 - 1 : forStar * 2;
  },
} as const;

/**
 * Display a 0.5…5.0 score as `3.5/5` (whole numbers without a decimal).
 * Empty string when score is missing / zero.
 */
export function formatScoreOutOfFive(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return '';
  const text = score % 1 === 0 ? String(score) : score.toFixed(1);
  return `${text}/5`;
}

/** Half-star steps (`1…10`) → `3.5/5`. */
export function formatHalfStarOutOfFive(rating: number): string {
  if (!RatingValue.isStarRating(rating)) return '';
  return formatScoreOutOfFive(RatingValue.starValue(rating));
}

/** Average of star ratings as 0.5…5.0 (Swift `overallScore`). */
export function overallScoreFromCriteria(criteria: CriterionRating[]): number {
  const rated = criteria
    .map((c) => c.rating)
    .filter((r) => RatingValue.isStarRating(r))
    .map((r) => RatingValue.starValue(r));
  if (rated.length === 0) return 0;
  return rated.reduce((a, b) => a + b, 0) / rated.length;
}

export function hasStarRating(criteria: CriterionRating[]): boolean {
  return criteria.some((c) => RatingValue.isStarRating(c.rating));
}

/** Labels for half-star steps (Swift `RatingLabels`). */
export function ratingLabel(rating: number): string {
  if (RatingValue.isNotApplicable(rating)) return i18n.t('rating.labels.na');
  if (!RatingValue.isStarRating(rating)) {
    return i18n.t('rating.labels.notRated');
  }
  const stars = RatingValue.starValue(rating);
  if (stars < 2) return i18n.t('rating.labels.poor');
  if (stars < 3) return i18n.t('rating.labels.okay');
  if (stars < 4) return i18n.t('rating.labels.good');
  if (stars < 5) return i18n.t('rating.labels.great');
  return i18n.t('rating.labels.perfect');
}

/** Migrate a legacy Expo integer 1–5 rating to half-star steps (`×2`). */
export function migrateLegacyCriterionRating(rating: number): number {
  if (RatingValue.isNotApplicable(rating)) return RatingValue.notApplicable;
  if (!Number.isFinite(rating) || rating <= 0) return RatingValue.unrated;
  if (rating >= 1 && rating <= 5) return Math.round(rating) * 2;
  if (rating > 5 && rating <= RatingValue.maxSteps) return Math.round(rating);
  return RatingValue.unrated;
}

/**
 * Map criterion ids onto the 20 fixed criteria without touching the rating
 * scale (v3 stores are already half-star steps). `wines` folds into `drinks`;
 * unknown custom ids map via `mapLegacyCriterionId`. Idempotent.
 */
export function mapCriteriaToFixed(criteria: CriterionRating[]): CriterionRating[] {
  const mapped: CriterionRating[] = [];
  for (const c of criteria) {
    const targetId = mapLegacyCriterionId(c.id, c.title);
    const comment = (c.comment ?? '').trim();
    const existing = mapped.find((n) => n.id === targetId);
    if (existing) {
      if (RatingValue.isStarRating(c.rating)) {
        if (
          !RatingValue.isStarRating(existing.rating) ||
          c.rating > existing.rating
        ) {
          existing.rating = c.rating;
        }
      }
      if (comment && !existing.comment.includes(comment)) {
        existing.comment = [existing.comment, comment]
          .filter(Boolean)
          .join(' · ');
      }
      continue;
    }
    mapped.push({ ...c, id: targetId, comment });
  }
  return mapped;
}

export function migrateLegacyCriteria(
  criteria: CriterionRating[],
): CriterionRating[] {
  // Normalize legacy integer 1–5 ratings to half-star steps, then map ids.
  const normalized = criteria.map((c) => ({
    ...c,
    rating: migrateLegacyCriterionRating(c.rating),
  }));
  return mapCriteriaToFixed(normalized);
}
