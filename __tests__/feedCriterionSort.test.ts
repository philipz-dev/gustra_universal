import { applyFeedFilters, type FeedFilterState } from '@/components/feed/feedFilters';
import type { RestaurantVisitSummary } from '@/data/types';

function summary(
  restaurantId: string,
  averageScore: number,
  extra: Partial<RestaurantVisitSummary> & { drinksRating?: number } = {},
): RestaurantVisitSummary {
  return {
    restaurantId,
    name: `Resto ${restaurantId}`,
    city: 'Gent',
    primaryType: 'restaurant',
    averageScore,
    visitCount: 1,
    lastVisitDate: '1 aug',
    lastVisitAt: +new Date('2026-08-01'),
    thumbnailColor: '#3D6B52',
    photoUrl: '',
    isFavorite: false,
    reviewIds: [`${restaurantId}-1`],
    ...extra,
  };
}

const criterionState: FeedFilterState = {
  filters: [],
  sortKind: { type: 'criterion', criterionId: 'drinks' },
  locationCities: [],
  primaryTypes: [],
};

const criterionAverageFor = (s: RestaurantVisitSummary) => {
  const rating = (s as { drinksRating?: number }).drinksRating;
  return typeof rating === 'number' ? rating : null;
};

describe('applyFeedFilters — sort by criterion', () => {
  it('keeps restaurants without a rating on the criterion (moves them to the bottom)', () => {
    const scored = summary('r1', 4.0, { drinksRating: 4.5 });
    const unscored = summary('r2', 3.0);

    const result = applyFeedFilters([unscored, scored], criterionState, {
      criterionAverageFor,
    });

    // Both remain visible — sorting no longer removes restaurants.
    expect(result).toHaveLength(2);
    // Scored restaurant first, unscored last.
    expect(result[0]!.restaurantId).toBe('r1');
    expect(result[1]!.restaurantId).toBe('r2');
  });

  it('sorts scored restaurants by the criterion score descending', () => {
    const low = summary('r1', 4.0, { drinksRating: 3.0 });
    const high = summary('r2', 3.0, { drinksRating: 4.5 });
    const medium = summary('r3', 2.0, { drinksRating: 4.0 });

    const result = applyFeedFilters([low, high, medium], criterionState, {
      criterionAverageFor,
    });

    expect(result.map((s) => s.restaurantId)).toEqual(['r2', 'r3', 'r1']);
  });

  it('keeps drafts on top even when sorting by criterion', () => {
    const draft = summary('r1', 0, { isDraft: true });
    const scored = summary('r2', 4.5, { drinksRating: 5.0 });

    const result = applyFeedFilters([scored, draft], criterionState, {
      criterionAverageFor,
    });

    expect(result.map((s) => s.restaurantId)).toEqual(['r1', 'r2']);
  });
});
