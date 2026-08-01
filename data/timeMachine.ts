import type { Restaurant, Review } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import { isReviewDraft } from '@/services/reviews/draftReview';

/** One visit on the Time Travel timeline. */
export type TimeMachineEntry = {
  reviewId: string;
  restaurantId: string;
  /** "Name, City" when a city is known. */
  restaurantTitle: string;
  /** ISO date of the visit (Review.date). */
  date: string;
  score: number;
  /** Best photo for this visit (review hero, else restaurant photo). */
  photoUrl: string;
  /** Restaurant thumbnail color for the fallback tile when no photo. */
  thumbnailColor: string;
};

function displayLocation(name: string, city: string): string {
  if (city.trim()) return `${name}, ${city}`;
  return name;
}

/**
 * All completed visits on the personal timeline (own reviews only, newest
 * first) for the Apple Time Machine-style timeline. Friend/imported reviews
 * are excluded so the timeline and its statistics only reflect your own
 * visits. Drafts are excluded as well (same rule as the passport stats).
 */
export function buildTimeMachineEntries(
  reviews: Review[],
  restaurants: Restaurant[],
): TimeMachineEntry[] {
  const restaurantById = new Map(restaurants.map((r) => [r.id, r]));
  return reviews
    .filter(
      (review) =>
        !isReviewDraft(review) && resolveReviewOrigin(review) === 'own',
    )
    .map((review) => {
      const restaurant = restaurantById.get(review.restaurantId);
      return {
        reviewId: review.id,
        restaurantId: review.restaurantId,
        restaurantTitle: restaurant
          ? displayLocation(restaurant.name, restaurant.city)
          : '—',
        date: review.date,
        score: review.overallScore,
        photoUrl:
          review.photoUrls[0]?.trim() || restaurant?.photoUrl?.trim() || '',
        thumbnailColor: restaurant?.thumbnailColor || '#3D6B52',
      };
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
