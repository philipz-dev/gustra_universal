import type { Restaurant, RestaurantVisitSummary, Review } from '@/data/types';

/** Curated Unsplash stills — dishes & dining interiors (w=800 for feed/detail). */
const photos = {
  greenhouseDish:
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
  greenhouseInterior:
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  fineDiningPlate:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  fineDiningRoom:
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  nordicPlating:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  nordicInterior:
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80',
  pastaClose:
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80',
  candleRestaurant:
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
  asianSpread:
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80',
  tastingMenu:
    'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
  seafoodPlate:
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
  vegetableCourse:
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
};

export const mockRestaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'De Kas',
    city: 'Amsterdam',
    address: 'Kamerlingh Onneslaan 3, 1097 DE Amsterdam',
    phone: '+31 20 462 4562',
    isFavorite: true,
    thumbnailColor: '#3D6B52',
    photoUrl: photos.greenhouseDish,
  },
  {
    id: 'r2',
    name: 'Restaurant Flore',
    city: 'Paris',
    address: '84 Rue du Bac, 75007 Paris',
    phone: '+33 1 45 44 38 32',
    isFavorite: false,
    thumbnailColor: '#5A4634',
    photoUrl: photos.fineDiningPlate,
  },
  {
    id: 'r3',
    name: 'Noma',
    city: 'Copenhagen',
    address: 'Refshalevej 96, 1432 København',
    isFavorite: true,
    thumbnailColor: '#2F4A3C',
    photoUrl: photos.nordicPlating,
  },
  {
    id: 'r4',
    name: 'Bar Bentricelli',
    city: 'Rome',
    address: 'Via della Lungaretta 75, 00153 Roma',
    phone: '+39 06 581 2320',
    isFavorite: false,
    thumbnailColor: '#6B4E3D',
    photoUrl: photos.pastaClose,
  },
  {
    id: 'r5',
    name: 'Toko',
    city: 'Amsterdam',
    address: 'Warmoesstraat 149, 1012 JC Amsterdam',
    isFavorite: false,
    thumbnailColor: '#4A5C3A',
    photoUrl: photos.asianSpread,
  },
];

export const mockReviews: Review[] = [
  {
    id: 'v1a',
    restaurantId: 'r1',
    date: '2026-06-12T19:30:00',
    generalComment: 'Garden greenhouse vibe — every plate tasted like it was picked that morning.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 5,
        comment: 'Tomato tart was unforgettable. Light, sharp, perfect acidity.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 4,
        comment: 'House juice pairing — bright and garden-fresh.',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 4,
        comment: 'Warm and knowledgeable without hovering.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 5,
        comment: 'Sitting inside a greenhouse at dusk is magic.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 4,
        comment: 'Pricey but fair for the experience.',
      },
    ],
    photoUrls: [photos.greenhouseDish, photos.greenhouseInterior],

    reviewedBy: 'Philip',
    overallScore: 4.5,
  },
  {
    id: 'v1b',
    restaurantId: 'r1',
    date: '2025-11-03T20:00:00',
    generalComment: 'Second visit — still excellent, slightly quieter kitchen energy.',
    criteria: [
      { id: 'food', title: 'Food', rating: 4, comment: 'Pumpkin risotto was cozy and deep.' },
      { id: 'service', title: 'Service', rating: 5, comment: 'Remembered our last visit.' },
      { id: 'setting', title: 'Atmosphere', rating: 4, comment: 'Autumn light through the glass.' },
      { id: 'valueForMoney', title: 'Value for Money', rating: 4, comment: '' },
    ],
    photoUrls: [photos.vegetableCourse],
    reviewedBy: 'Philip',
    overallScore: 4.3,
  },
  {
    id: 'v2a',
    restaurantId: 'r2',
    date: '2026-04-18T13:00:00',
    generalComment: 'Quiet luxury lunch. Precision cooking, almost silent dining room.',
    criteria: [
      { id: 'food', title: 'Food', rating: 5, comment: 'Langoustine with citrus — perfect.' },
      { id: 'drinks', title: 'Drinks', rating: 5, comment: 'Wine pairing was precise and generous.' },
      { id: 'service', title: 'Service', rating: 5, comment: 'Ballet-level timing.' },
      { id: 'setting', title: 'Atmosphere', rating: 4, comment: 'Elegant, a touch formal.' },
      { id: 'valueForMoney', title: 'Value for Money', rating: 3, comment: 'Special-occasion pricing.' },
    ],
    photoUrls: [photos.fineDiningPlate, photos.fineDiningRoom],

    reviewedBy: 'Philip',
    overallScore: 4.3,
  },
  {
    id: 'v3a',
    restaurantId: 'r3',
    date: '2025-09-22T18:00:00',
    generalComment: 'A night that rewires how you think about vegetables.',
    criteria: [
      { id: 'food', title: 'Food', rating: 5, comment: 'Ferments and fire. Every course a story.' },
      { id: 'service', title: 'Service', rating: 5, comment: 'Guides you through without spoiling the surprise.' },
      { id: 'setting', title: 'Atmosphere', rating: 5, comment: 'Warehouse calm, Nordic warmth.' },
      { id: 'valueForMoney', title: 'Value for Money', rating: 4, comment: 'Worth it once.' },
    ],
    photoUrls: [photos.nordicPlating, photos.nordicInterior, photos.tastingMenu],
    reviewedBy: 'Philip',
    overallScore: 4.8,
  },
  {
    id: 'v3b',
    restaurantId: 'r3',
    date: '2024-08-10T18:30:00',
    generalComment: 'First time — left speechless.',
    criteria: [
      { id: 'food', title: 'Food', rating: 5, comment: 'Seafood season was peak.' },
      { id: 'service', title: 'Service', rating: 4, comment: '' },
      { id: 'setting', title: 'Atmosphere', rating: 5, comment: '' },
      { id: 'valueForMoney', title: 'Value for Money', rating: 4, comment: '' },
    ],
    photoUrls: [photos.seafoodPlate],
    reviewedBy: 'Philip',
    overallScore: 4.5,
  },
  {
    id: 'v4a',
    restaurantId: 'r4',
    date: '2026-05-02T21:15:00',
    generalComment: 'Late-night Roman pasta. Tiny room, big flavor.',
    criteria: [
      { id: 'food', title: 'Food', rating: 4, comment: 'Cacio e pepe done right — peppery, glossy.' },
      { id: 'service', title: 'Service', rating: 3, comment: 'Busy and a bit brusque, in a charming way.' },
      { id: 'setting', title: 'Atmosphere', rating: 4, comment: 'Candlelight, crowded tables.' },
      { id: 'valueForMoney', title: 'Value for Money', rating: 5, comment: 'Excellent for the price.' },
    ],
    photoUrls: [photos.pastaClose, photos.candleRestaurant],
    reviewedBy: 'Philip',
    overallScore: 4.0,
  },
  {
    id: 'v5a',
    restaurantId: 'r5',
    date: '2026-03-08T12:45:00',
    generalComment: 'Quick Indonesian lunch before a meeting. Reliable classic.',
    criteria: [
      { id: 'food', title: 'Food', rating: 3, comment: 'Solid rijsttafel, nothing surprising.' },
      { id: 'service', title: 'Service', rating: 3, comment: 'Fine for a busy lunch rush.' },
      { id: 'setting', title: 'Atmosphere', rating: 3, comment: 'Touristy but comfortable.' },
      { id: 'valueForMoney', title: 'Value for Money', rating: 3, comment: '' },
    ],
    photoUrls: [photos.asianSpread],
    reviewedBy: 'Philip',
    overallScore: 3.0,
  },
];

function formatAbbreviated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getRestaurant(id: string): Restaurant | undefined {
  return mockRestaurants.find((r) => r.id === id);
}

export function getReview(id: string): Review | undefined {
  return mockReviews.find((r) => r.id === id);
}

export function getReviewsForRestaurant(restaurantId: string): Review[] {
  return mockReviews
    .filter((r) => r.restaurantId === restaurantId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function getFeedSummaries(): RestaurantVisitSummary[] {
  const summaries: RestaurantVisitSummary[] = [];

  for (const restaurant of mockRestaurants) {
    const visits = getReviewsForRestaurant(restaurant.id);
    if (visits.length === 0) continue;
    const averageScore =
      visits.reduce((sum, v) => sum + v.overallScore, 0) / visits.length;
    // Prefer latest visit photo; fall back to restaurant thumbnail.
    const latestPhoto = visits[0].photoUrls[0] ?? restaurant.photoUrl;
    summaries.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      city: restaurant.city,
      averageScore,
      visitCount: visits.length,
      lastVisitDate: formatAbbreviated(visits[0].date),
      reviewerName: visits[0].reviewedBy,
      thumbnailColor: restaurant.thumbnailColor,
      photoUrl: latestPhoto,
      isFavorite: restaurant.isFavorite,
      reviewIds: visits.map((v) => v.id),
    });
  }

  return summaries.sort((a, b) => b.averageScore - a.averageScore);
}

export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
