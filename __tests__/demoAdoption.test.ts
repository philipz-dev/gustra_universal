import {
  mockRestaurants,
  mockReviews,
  stripShippingSeedData,
  stripDemoShowcase,
  mergeDemoShowcase,
  isDemoRestaurantId,
} from '@/data/mockReviews';
import type { Restaurant, Review } from '@/data/types';

// Real showcase rows (mirrors data/mockReviews.ts) — Atelier Bac is demo-r2.
const atelierBac = mockRestaurants.find((r) => r.id === 'demo-r2')!;
const atelierBacReview = mockReviews.find((r) => r.restaurantId === 'demo-r2')!;

function ownReviewOnDemo(): { restaurants: Restaurant[]; reviews: Review[] } {
  // The user created their own review pointing at the demo restaurant
  // (exactly what happened on-device: v_msd8yicw_25s2zx → demo-r2).
  const userReview: Review = {
    ...atelierBacReview,
    id: 'v_user_own_atelier',
    date: '2026-08-03T13:08:58.617Z',
    origin: 'own',
    reviewedBy: '',
  };
  return {
    restaurants: [atelierBac],
    reviews: [userReview],
  };
}

describe('demo showcase adoption (own review on demo venue)', () => {
  it('adopts the demo restaurant into a user id and keeps the review', () => {
    const { restaurants, reviews } = ownReviewOnDemo();
    const cleaned = stripDemoShowcase(restaurants, reviews);

    expect(cleaned.reviews).toHaveLength(1);
    expect(cleaned.reviews[0]!.id).toBe('v_user_own_atelier');

    // Restaurant is kept (user data preserved) but no longer flagged demo.
    expect(cleaned.restaurants).toHaveLength(1);
    expect(cleaned.restaurants[0]!.name).toBe('Atelier Bac');
    expect(cleaned.restaurants[0]!.id).toBe('user-r2');
    expect(isDemoRestaurantId(cleaned.restaurants[0]!.id)).toBe(false);

    // Review follows the adopted restaurant id.
    expect(cleaned.reviews[0]!.restaurantId).toBe('user-r2');
  });

  it('re-enabling the showcase does not duplicate the adopted venue', () => {
    const { restaurants, reviews } = ownReviewOnDemo();
    const stripped = stripDemoShowcase(restaurants, reviews);

    // User re-enables demo showcase: merge onto adopted data.
    const merged = mergeDemoShowcase(stripped.restaurants, stripped.reviews);

    // Atelier Bac appears exactly once (adopted user-r2, not demo-r2 again).
    const bacCount = merged.restaurants.filter(
      (r) => r.name === 'Atelier Bac',
    ).length;
    expect(bacCount).toBe(1);
  });

  it('drops pure showcase data when disabled', () => {
    const cleaned = stripShippingSeedData(mockRestaurants, mockReviews);
    expect(cleaned.restaurants).toHaveLength(0);
    expect(cleaned.reviews).toHaveLength(0);
    expect(cleaned.stripped).toBe(true);
  });

  it('is idempotent — a second strip does not change adopted rows', () => {
    const { restaurants, reviews } = ownReviewOnDemo();
    const once = stripDemoShowcase(restaurants, reviews);
    const twice = stripDemoShowcase(once.restaurants, once.reviews);

    expect(twice.restaurants[0]!.id).toBe('user-r2');
    expect(twice.reviews[0]!.restaurantId).toBe('user-r2');
  });
});
