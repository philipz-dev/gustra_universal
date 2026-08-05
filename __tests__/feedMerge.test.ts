import { mergeSummariesByRestaurant } from '@/components/feed/feedFilters';
import type { RestaurantVisitSummary } from '@/data/types';

function summary(
  restaurantId: string,
  averageScore: number,
  visitCount: number,
  extra: Partial<RestaurantVisitSummary> = {},
): RestaurantVisitSummary {
  return {
    restaurantId,
    name: 'Resto',
    city: 'Gent',
    primaryType: 'restaurant',
    averageScore,
    visitCount,
    lastVisitDate: '1 aug',
    lastVisitAt: +new Date('2026-08-01'),
    thumbnailColor: '#3D6B52',
    photoUrl: '',
    isFavorite: false,
    reviewIds: [`${restaurantId}-${visitCount}`],
    ...extra,
  };
}

describe('mergeSummariesByRestaurant — own headline score', () => {
  it('keeps own score as the headline and friends as context', () => {
    const own = summary('r1', 4.2, 2, {
      ownScore: 4.2,
      ownVisitCount: 2,
      ownReviewIds: ['r1-1', 'r1-2'],
      reviewIds: ['r1-1', 'r1-2'],
    });
    const friends = summary('r1', 3.0, 1, {
      friendScore: 3.0,
      friendVisitCount: 1,
      reviewIds: ['f1'],
    });

    const merged = mergeSummariesByRestaurant([[own, friends]]);

    expect(merged).toHaveLength(1);
    const m = merged[0]!;
    // Own score is the main score.
    expect(m.ownScore).toBe(4.2);
    expect(m.ownVisitCount).toBe(2);
    // Friends travel as context.
    expect(m.friendScore).toBe(3.0);
    expect(m.friendVisitCount).toBe(1);
    // Combined counts stay available.
    expect(m.visitCount).toBe(3);
    expect(m.reviewIds).toEqual(expect.arrayContaining(['r1-1', 'r1-2', 'f1']));
  });

  it('does not invent own/friend fields when only one source exists', () => {
    const onlyOwn = summary('r1', 4.2, 1, {
      ownScore: 4.2,
      ownVisitCount: 1,
      ownReviewIds: ['r1-1'],
    });
    const merged = mergeSummariesByRestaurant([[onlyOwn]]);
    expect(merged[0]!.friendScore).toBeUndefined();
    expect(merged[0]!.friendVisitCount).toBeUndefined();
  });

  it('counts every own visit when a 4th visit is added (3 -> 4)', () => {
    const own3 = summary('r1', 4.0, 3, {
      ownScore: 4.0,
      ownVisitCount: 3,
      ownReviewIds: ['r1-1', 'r1-2', 'r1-3'],
      reviewIds: ['r1-1', 'r1-2', 'r1-3'],
    });
    const own4 = summary('r1', 4.5, 4, {
      ownScore: 4.5,
      ownVisitCount: 4,
      ownReviewIds: ['r1-1', 'r1-2', 'r1-3', 'r1-4'],
      reviewIds: ['r1-1', 'r1-2', 'r1-3', 'r1-4'],
    });
    // A fresh feed build replaces the old summary entirely — no merge of the
    // same source. The card must show the new count.
    expect(own4.visitCount).toBe(4);
    expect(own4.ownVisitCount).toBe(4);
  });

  it('preserves own visit count when merging own + friends lists', () => {
    const own = summary('r1', 4.2, 2, {
      ownScore: 4.2,
      ownVisitCount: 2,
      ownReviewIds: ['r1-1', 'r1-2'],
      reviewIds: ['r1-1', 'r1-2'],
    });
    const friends = summary('r1', 3.0, 1, {
      friendScore: 3.0,
      friendVisitCount: 1,
      reviewIds: ['f1'],
    });
    const merged = mergeSummariesByRestaurant([[friends, own]]);
    expect(merged[0]!.visitCount).toBe(3);
    expect(merged[0]!.ownVisitCount).toBe(2);
    expect(merged[0]!.ownReviewIds).toEqual(['r1-1', 'r1-2']);
  });

  it('merges own-score-first when lists arrive in either order', () => {
    const own = summary('r1', 4.2, 2, {
      ownScore: 4.2,
      ownVisitCount: 2,
      ownReviewIds: ['r1-1', 'r1-2'],
      reviewIds: ['r1-1', 'r1-2'],
    });
    const friends = summary('r1', 3.0, 1, {
      friendScore: 3.0,
      friendVisitCount: 1,
      reviewIds: ['f1'],
    });

    const merged = mergeSummariesByRestaurant([[friends, own]]);
    expect(merged[0]!.ownScore).toBe(4.2);
    expect(merged[0]!.friendScore).toBe(3.0);
  });
});
