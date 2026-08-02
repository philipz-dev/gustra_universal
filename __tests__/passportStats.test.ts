import {
  getPassportStats,
  getTimeTravelStats,
  getBestWines,
} from '@/data/passportStats';
import { buildTimeMachineEntries } from '@/data/timeMachine';
import type { CriterionRating, Restaurant, Review } from '@/data/types';

function criteria(ratings: Record<string, number>): CriterionRating[] {
  return Object.entries(ratings).map(([id, rating]) => ({
    id,
    title: id,
    rating,
    comment: '',
  }));
}

function restaurant(id: string, name: string, city: string): Restaurant {
  return {
    id,
    name,
    city,
    country: 'BE',
    address: 'Straat 1',
    latitude: 51,
    longitude: 4,
    primaryType: 'restaurant',
    isFavorite: false,
    thumbnailColor: '#3D6B52',
    photoUrl: '',
  };
}

function review(
  id: string,
  restaurantId: string,
  date: string,
  ratings: Record<string, number>,
  extra: Partial<Review> = {},
): Review {
  return {
    id,
    restaurantId,
    date,
    generalComment: '',
    criteria: criteria(ratings),
    photoUrls: [],
    reviewedBy: '',
    overallScore: 0,
    origin: 'own',
    ...extra,
  };
}

const ENABLED = [
  { id: 'food', title: 'Food' },
  { id: 'service', title: 'Service' },
];

describe('getPassportStats', () => {
  it('returns empty stats for no reviews', () => {
    const stats = getPassportStats(ENABLED, [], []);
    expect(stats.totalReviews).toBe(0);
    expect(stats.averageOverall).toBe(0);
    expect(stats.bestRestaurants).toEqual([]);
    expect(stats.cityAverages).toEqual([]);
  });

  it('computes totals, top restaurants and cities', () => {
    const restaurants = [
      restaurant('r1', 'Het Huis', 'Gent'),
      restaurant('r2', 'De Tuin', 'Brugge'),
    ];
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8, service: 6 }), // avg 3.5
      review('b', 'r1', '2024-07-01', { food: 6, service: 8 }), // avg 3.5
      review('c', 'r2', '2024-08-01', { food: 10, service: 8 }), // avg 4.5
    ];
    const stats = getPassportStats(ENABLED, reviews, restaurants);

    expect(stats.totalReviews).toBe(3);
    // (3.5 + 3.5 + 4.5) / 3
    expect(stats.averageOverall).toBeCloseTo(3.8333, 3);

    // Top-3: De Tuin first, Het Huis second (both have 1 entry in the buckets)
    expect(stats.bestRestaurants[0]!.restaurantId).toBe('r2');
    expect(stats.bestRestaurants[0]!.average).toBeCloseTo(4.5, 3);
    expect(stats.bestRestaurants[1]!.restaurantId).toBe('r1');
    expect(stats.bestRestaurants[1]!.average).toBeCloseTo(3.5, 3);

    // Cities: Gent 3.5, Brugge 4.5 → Brugge first
    expect(stats.cityAverages[0]!.city).toBe('Brugge');
    expect(stats.cityAverages[1]!.city).toBe('Gent');
  });

  it('excludes drafts from the totals', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8 }), // complete
      review('b', 'r1', '2024-07-01', { food: 0 }), // draft
    ];
    const stats = getPassportStats(ENABLED, reviews, restaurants);
    expect(stats.totalReviews).toBe(1);
    expect(stats.averageOverall).toBeCloseTo(4, 3);
  });

  it('caps the top restaurant list at 3', () => {
    const restaurants = [1, 2, 3, 4].map((n) =>
      restaurant(`r${n}`, `Resto ${n}`, 'Gent'),
    );
    const reviews = [1, 2, 3, 4].map((n) =>
      review(`a${n}`, `r${n}`, '2024-06-01', { food: 2 * n }),
    );
    const stats = getPassportStats(ENABLED, reviews, restaurants);
    expect(stats.bestRestaurants).toHaveLength(3);
  });
});

describe('getTimeTravelStats', () => {
  it('rolls up entries per year, newest first', () => {
    const entries = [
      {
        reviewId: 'a',
        restaurantId: 'r1',
        restaurantTitle: 'X, Gent',
        date: '2023-05-01',
        score: 3,
        photoUrl: '',
        thumbnailColor: '#000',
      },
      {
        reviewId: 'b',
        restaurantId: 'r1',
        restaurantTitle: 'X, Gent',
        date: '2024-05-01',
        score: 4,
        photoUrl: '',
        thumbnailColor: '#000',
      },
      {
        reviewId: 'c',
        restaurantId: 'r1',
        restaurantTitle: 'X, Gent',
        date: '2024-11-01',
        score: 5,
        photoUrl: '',
        thumbnailColor: '#000',
      },
    ];
    const stats = getTimeTravelStats(entries);
    expect(stats.totalAllTime).toBe(3);
    expect(stats.averageAllTime).toBeCloseTo(4, 3);
    expect(stats.years.map((y) => y.year)).toEqual([2024, 2023]);
    expect(stats.years[0]!.totalReviews).toBe(2);
    expect(stats.years[0]!.averageScore).toBeCloseTo(4.5, 3);
  });

  it('returns empty stats for no entries', () => {
    expect(getTimeTravelStats([])).toEqual({
      years: [],
      totalAllTime: 0,
      averageAllTime: 0,
    });
  });
});

describe('getBestWines', () => {
  it('ranks individually-rated bottles and skips drafts', () => {
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8 }, {
        wineLabels: [
          { labelPhotoUri: 'x', nameAndEstate: 'Wine A', userRating: 6 },
          { labelPhotoUri: 'y', nameAndEstate: 'Wine B', userRating: 9 },
        ],
      }),
      review('b', 'r1', '2024-07-01', { food: 0 }, {
        wineLabels: [{ labelPhotoUri: 'z', nameAndEstate: 'Draft Wine', userRating: 10 }],
      }),
    ];
    const best = getBestWines(reviews);
    expect(best).toHaveLength(2);
    expect(best[0]!.fiche.nameAndEstate).toBe('Wine B');
    expect(best[1]!.fiche.nameAndEstate).toBe('Wine A');
  });

  it('returns empty when no bottle is star-rated', () => {
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8 }, {
        wineLabels: [{ labelPhotoUri: 'x', nameAndEstate: 'Wine A' }],
      }),
    ];
    expect(getBestWines(reviews)).toEqual([]);
  });
});

describe('buildTimeMachineEntries', () => {
  it('filters to own, non-draft reviews and sorts newest first', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8 }),
      review('b', 'r1', '2024-09-01', { food: 0 }), // draft → excluded
      review('c', 'r1', '2024-07-01', { food: 6 }, { origin: 'imported', reviewedBy: 'Piet' }), // friend → excluded
      review('d', 'r1', '2025-01-01', { food: 10 }),
    ];
    const entries = buildTimeMachineEntries(reviews, restaurants);
    expect(entries.map((e) => e.reviewId)).toEqual(['d', 'a']);
    expect(entries[0]!.restaurantTitle).toBe('Het Huis, Gent');
  });

  it('falls back to a dash title when the restaurant is unknown', () => {
    const entries = buildTimeMachineEntries(
      [review('a', 'missing', '2024-06-01', { food: 8 })],
      [],
    );
    expect(entries[0]!.restaurantTitle).toBe('—');
  });

  it('shows each visit its own cover photo only', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8 }), // no photo
      review('b', 'r1', '2025-01-01', { food: 10 }, { photoUrls: ['file:///b.jpg'] }),
    ];
    const entries = buildTimeMachineEntries(reviews, restaurants);
    // Newest visit (b) shows its own photo; the older visit (a) has no photo
    // and stays empty — photos are never borrowed from other visits.
    expect(entries[0]!.photoUrl).toBe('file:///b.jpg');
    expect(entries[1]!.photoUrl).toBe('');
  });

  it('skips an empty first slot and uses the next real photo as cover', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const reviews = [
      review('a', 'r1', '2024-06-01', { food: 8 }, {
        photoUrls: ['', 'file:///second.jpg'],
      }),
    ];
    const entries = buildTimeMachineEntries(reviews, restaurants);
    // A blank first slot must not hide the real photo at index 1.
    expect(entries[0]!.photoUrl).toBe('file:///second.jpg');
  });

  it('keeps each visit own photo regardless of other visits', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const reviews = [
      review('a', 'r1', '2024-03-01', { food: 8 }, {
        photoUrls: ['file:///oldest.jpg'],
      }),
      review('b', 'r1', '2024-06-01', { food: 9 }, {
        photoUrls: ['file:///middle.jpg'],
      }),
      review('c', 'r1', '2025-01-01', { food: 10 }, {
        photoUrls: ['file:///newest.jpg'],
      }),
    ];
    const entries = buildTimeMachineEntries(reviews, restaurants);
    // Every visit shows exactly its own cover photo.
    expect(entries[0]!.photoUrl).toBe('file:///newest.jpg');
    expect(entries[1]!.photoUrl).toBe('file:///middle.jpg');
    expect(entries[2]!.photoUrl).toBe('file:///oldest.jpg');
  });

  it('leaves photo-less visits empty even when another visit has a photo', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const reviews = [
      review('a', 'r1', '2024-03-01', { food: 8 }), // no photo
      review('b', 'r1', '2024-06-01', { food: 9 }), // no photo
      review('c', 'r1', '2025-01-01', { food: 10 }, {
        photoUrls: ['file:///only.jpg'],
      }),
    ];
    const entries = buildTimeMachineEntries(reviews, restaurants);
    // Only the newest visit has a photo — the two older visits stay empty
    // (green tile) instead of reusing that photo.
    expect(entries[0]!.photoUrl).toBe('file:///only.jpg');
    expect(entries[1]!.photoUrl).toBe('');
    expect(entries[2]!.photoUrl).toBe('');
  });

  it('spreads a single visit with multiple photos across the other visits', () => {
    const restaurants = [restaurant('r1', 'Dirty Habit', 'San Francisco')];
    const reviews = [
      review('a', 'r1', '2024-03-01', { food: 8 }), // no photo
      review('b', 'r1', '2025-01-01', { food: 10 }, {
        photoUrls: ['file:///newest.jpg', 'file:///second.jpg'],
      }),
    ];
    const entries = buildTimeMachineEntries(reviews, restaurants);
    // The newest visit keeps its own cover; the photo-less older visit is
    // empty — no borrowing across visits.
    expect(entries[0]!.photoUrl).toBe('file:///newest.jpg');
    expect(entries[1]!.photoUrl).toBe('');
  });

  it('keeps an empty cover when no visit has a photo', () => {
    const restaurants = [restaurant('r1', 'Het Huis', 'Gent')];
    const entries = buildTimeMachineEntries(
      [review('a', 'r1', '2024-06-01', { food: 8 })],
      restaurants,
    );
    expect(entries[0]!.photoUrl).toBe('');
  });
});
