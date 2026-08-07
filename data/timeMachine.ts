import type { Restaurant, Review } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import { isReviewDraft } from '@/services/reviews/draftReview';
import { overallScoreFromCriteria } from '@/services/reviews/ratings';

/** One visit on the Time Travel timeline. */
export type TimeMachineEntry = {
  reviewId: string;
  restaurantId: string;
  /** "Name, City" when a city is known. */
  restaurantTitle: string;
  /** ISO date of the visit (Review.date). */
  date: string;
  score: number;
  /** This visit's own cover photo — empty when the visit has no photo. */
  photoUrl: string;
  /** Restaurant thumbnail color for the fallback tile when no photo. */
  thumbnailColor: string;
};

function displayLocation(name: string, city: string): string {
  if (city.trim()) return `${name}, ${city}`;
  return name;
}

/** First non-empty photo URI from a review’s ordered list (cover = index 0). */
function firstPhotoUrl(photoUrls: string[] | undefined): string {
  if (!photoUrls?.length) return '';
  for (const raw of photoUrls) {
    const uri = raw?.trim();
    if (uri) return uri;
  }
  return '';
}

/**
 * All completed visits on the personal timeline (own reviews only, newest
 * first) for the Apple Time Machine-style timeline. Friend/imported reviews
 * are excluded so the timeline and its statistics only reflect your own
 * visits. Drafts are excluded as well (same rule as the passport stats).
 *
 * Photos: each visit shows exactly its own cover photo (the first non-empty
 * photo of that visit). A visit without a photo gets an empty `photoUrl` and
 * renders as the green house-style tile — photos are never borrowed from
 * other visits.
 */
export function buildTimeMachineEntries(
  reviews: Review[],
  restaurants: Restaurant[],
): TimeMachineEntry[] {
  const restaurantById = new Map(restaurants.map((r) => [r.id, r]));
  const ownComplete = reviews
    .filter(
      (review) =>
        !isReviewDraft(review) && resolveReviewOrigin(review) === 'own',
    )
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return ownComplete.map((review) => {
    const restaurant = restaurantById.get(review.restaurantId);
    return {
      reviewId: review.id,
      restaurantId: review.restaurantId,
      restaurantTitle: restaurant
        ? displayLocation(restaurant.name, restaurant.city)
        : '—',
      date: review.date,
      score: overallScoreFromCriteria(review.criteria),
      photoUrl: firstPhotoUrl(review.photoUrls),
      thumbnailColor: restaurant?.thumbnailColor || '#3D6B52',
    };
  });
}
