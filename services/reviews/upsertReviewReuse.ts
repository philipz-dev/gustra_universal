import type { Review } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import { isReviewDraft } from '@/services/reviews/draftReview';

/**
 * Find the review that a form upsert without an explicit `reviewId` should
 * update, instead of creating a brand-new visit.
 *
 * Only an in-progress **draft** for the same restaurant + exact visit
 * timestamp is reused (so a concurrent autosave/Done cannot create a
 * duplicate draft). A completed review is never silently overwritten — two
 * visits on the same day (e.g. adding a 4th visit today) always create a new
 * review rather than replacing an existing one.
 */
export function findReviewToReuse(
  reviews: Review[],
  restaurantId: string,
  visitDateIso: string,
): Review | undefined {
  return reviews.find(
    (r) =>
      r.restaurantId === restaurantId &&
      resolveReviewOrigin(r) === 'own' &&
      isReviewDraft(r) &&
      r.date === visitDateIso,
  );
}
