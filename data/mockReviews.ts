import type {
  Restaurant,
  RestaurantVisitSummary,
  Review,
  ReviewOrigin,
  WineLabelFiche,
} from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import {
  formatAbbreviatedDate,
  formatReviewDateTime,
} from '@/i18n/formatDates';

/**
 * Marketing / QA showcase data.
 * Fictional restaurant names on real street addresses (maps & directions work).
 * IDs are always prefixed with `demo-` so they never collide with user data.
 */

/** Curated Unsplash stills — dishes, interiors, wine (w=800 for feed/detail). */
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
  vegetableCourse:
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
  steakPlate:
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
  bistroInterior:
    'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80',
  wineRedLabel:
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
  wineWhiteLabel:
    'https://images.unsplash.com/photo-1569529465841-dfecdabaa329?w=800&q=80',
  dessertPlate:
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
  /* ——— People: friends at the table, toasts, shared moments ——— */
  friendsToast:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
  friendsDinner:
    'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80',
  friendsLaughing:
    'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80',
  friendsCheers:
    'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&q=80',
  tableTogether:
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80',
  peopleAtTable:
    'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800&q=80',
  groupToast:
    'https://images.unsplash.com/photo-1647905555465-0f9004fbdaed?w=800&q=80',
};

const wineAtelierBac: WineLabelFiche = {
  labelPhotoUri: photos.wineRedLabel,
  nameAndEstate: 'Clos des Lucioles — Pinot Noir',
  typeStyle: 'red',
  countryRegion: 'Burgundy, France',
  vintage: '2021',
  grapes: 'Pinot Noir',
  grapeVarieties: ['Pinot Noir'],
  grapeBlend: [{ name: 'Pinot Noir', percent: 100 }],
  alcoholPercent: 13,
  foodPairings: 'Duck, mushroom risotto, soft cheeses',
  tastingTraits: [
    { key: 'tannins', score: 2 },
    { key: 'body', score: 3 },
    { key: 'acidity', score: 4 },
    { key: 'sweetness', score: 1 },
  ],
  servingTempHint: '14–16 °C',
  aerationHint: '30 minutes in the glass',
  drinkWindowHint: 'Now–2029',
  tasteProfileConfidence: 'high',
  analyzedAt: '2026-04-18T14:10:00.000Z',
  userRating: 9,
  userComment: 'Silky cherry and forest floor — perfect with the duck.',
};

const wineHarbourFire: WineLabelFiche = {
  labelPhotoUri: photos.wineWhiteLabel,
  nameAndEstate: 'Skærgaard — Skin-Contact Riesling',
  typeStyle: 'orange',
  countryRegion: 'Zealand, Denmark',
  vintage: '2022',
  grapes: 'Riesling',
  grapeVarieties: ['Riesling'],
  grapeBlend: [{ name: 'Riesling', percent: 100 }],
  alcoholPercent: 11.5,
  foodPairings: 'Fermented vegetables, shellfish, mild cheeses',
  tastingTraits: [
    { key: 'tannins', score: 2 },
    { key: 'body', score: 3 },
    { key: 'acidity', score: 5 },
    { key: 'sweetness', score: 2 },
  ],
  servingTempHint: '10–12 °C',
  aerationHint: 'Serve cool; no decant needed',
  drinkWindowHint: 'Now–2027',
  tasteProfileConfidence: 'high',
  analyzedAt: '2025-09-22T19:05:00.000Z',
  userRating: 10,
  userComment: 'Tangerine peel and tea leaf — pairs wildly with the ferments.',
};

/** Showcase restaurants — fictional names, real coordinates/addresses. */
export const mockRestaurants: Restaurant[] = [
  {
    id: 'demo-r1',
    name: 'Orangerie Kas',
    city: 'Amsterdam',
    country: 'Netherlands',
    address: 'Kamerlingh Onneslaan 3, 1097 DE Amsterdam',
    phone: '+31 20 462 4562',
    latitude: 52.3506,
    longitude: 4.9312,
    mapItemIdentifier: null,
    primaryType: 'restaurant',
    isFavorite: true,
    isInBucketList: false,
    thumbnailColor: '#3D6B52',
    // Landscape interior (not the portrait dish) so the passport hero crop
    // stays cinematic instead of zooming into a narrow strip of the photo.
    photoUrl: photos.greenhouseInterior,
  },
  {
    id: 'demo-r2',
    name: 'Atelier Bac',
    city: 'Paris',
    country: 'France',
    address: '84 Rue du Bac, 75007 Paris',
    phone: '+33 1 45 44 38 32',
    latitude: 48.8553,
    longitude: 2.3292,
    mapItemIdentifier: null,
    primaryType: 'fine_dining_restaurant',
    isFavorite: true,
    isInBucketList: false,
    thumbnailColor: '#5A4634',
    photoUrl: photos.fineDiningPlate,
  },
  {
    id: 'demo-r3',
    name: 'Harbour Fire',
    city: 'Copenhagen',
    country: 'Denmark',
    address: 'Refshalevej 96, 1432 København',
    latitude: 55.6827,
    longitude: 12.6101,
    mapItemIdentifier: null,
    primaryType: 'fine_dining_restaurant',
    isFavorite: false,
    isInBucketList: false,
    thumbnailColor: '#2F4A3C',
    photoUrl: photos.nordicPlating,
  },
  {
    id: 'demo-r4',
    name: 'Lume di Trastevere',
    city: 'Rome',
    country: 'Italy',
    address: 'Via della Lungaretta 75, 00153 Roma',
    phone: '+39 06 581 2320',
    latitude: 41.8893,
    longitude: 12.4708,
    mapItemIdentifier: null,
    primaryType: 'italian_restaurant',
    isFavorite: false,
    isInBucketList: false,
    thumbnailColor: '#6B4E3D',
    photoUrl: photos.pastaClose,
  },
  {
    id: 'demo-r5',
    name: 'Canal Spice House',
    city: 'Amsterdam',
    country: 'Netherlands',
    address: 'Warmoesstraat 149, 1012 JC Amsterdam',
    latitude: 52.3758,
    longitude: 4.8975,
    mapItemIdentifier: null,
    primaryType: 'indonesian_restaurant',
    isFavorite: false,
    isInBucketList: false,
    thumbnailColor: '#4A5C3A',
    photoUrl: photos.asianSpread,
  },
  {
    id: 'demo-r6',
    name: 'Maison Jourdan',
    city: 'Brussels',
    country: 'Belgium',
    address: 'Place Jourdan 1, 1040 Bruxelles',
    phone: '+32 2 230 22 22',
    latitude: 50.8362,
    longitude: 4.3815,
    mapItemIdentifier: null,
    primaryType: 'french_restaurant',
    isFavorite: true,
    isInBucketList: false,
    thumbnailColor: '#6B5344',
    photoUrl: photos.steakPlate,
  },
];

/** One polished visit per showcase restaurant. */
export const mockReviews: Review[] = [
  {
    id: 'demo-v1',
    restaurantId: 'demo-r1',
    date: '2026-06-12T19:30:00',
    generalComment:
      'Dinner under glass as the light faded — every plate tasted like it was picked that morning. The greenhouse hush makes you slow down and actually taste.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 10,
        comment:
          'Heirloom tomato tart with basil oil — bright, sharp, unforgettable.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 8,
        comment: 'Garden juice pairing: cucumber, apple, a whisper of mint.',
      },
      {
        id: 'wines',
        title: 'Wines',
        rating: 0,
        comment: '',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 9,
        comment: 'Warm and precise without hovering.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 10,
        comment: 'Dusk through the glass roof is pure theatre.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 8,
        comment: 'Special-occasion pricing that still feels earned.',
      },
    ],
    photoUrls: [
      photos.friendsDinner,
      photos.greenhouseDish,
      photos.greenhouseInterior,
      photos.vegetableCourse,
    ],
    reviewedBy: 'You',
    origin: 'own',
    overallScore: 4.6,
  },
  {
    id: 'demo-v2',
    restaurantId: 'demo-r2',
    date: '2026-04-18T13:00:00',
    generalComment:
      'Quiet luxury lunch on the Left Bank. Precision cooking, almost silent dining room — the kind of meal you replay for weeks.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 10,
        comment: 'Langoustine with citrus and fennel pollen — perfect.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 8,
        comment: '',
      },
      {
        id: 'wines',
        title: 'Wines',
        rating: 9,
        comment: 'Clos des Lucioles Pinot with the duck course.',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 10,
        comment: 'Ballet-level timing between courses.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 9,
        comment: 'Cream walls, soft light, Paris outside the window.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 6,
        comment: 'A celebration lunch — budget accordingly.',
      },
    ],
    photoUrls: [
      photos.peopleAtTable,
      photos.fineDiningPlate,
      photos.fineDiningRoom,
      photos.dessertPlate,
    ],
    wineLabel: wineAtelierBac,
    wineLabels: [wineAtelierBac],
    reviewedBy: 'You',
    origin: 'own',
    overallScore: 4.5,
  },
  {
    id: 'demo-v3',
    restaurantId: 'demo-r3',
    date: '2025-09-22T18:00:00',
    generalComment:
      'A harbour warehouse that rewires how you think about vegetables. Smoke, ferments, and a skin-contact Riesling that somehow belongs.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 10,
        comment: 'Fire-roasted roots and fermented greens — every course a story.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 8,
        comment: '',
      },
      {
        id: 'wines',
        title: 'Wines',
        rating: 10,
        comment: 'Skærgaard orange Riesling — tangerine peel and tea.',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 10,
        comment: 'Guides you without spoiling the surprise.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 10,
        comment: 'Warehouse calm, Nordic warmth, water just outside.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 8,
        comment: 'Worth it once — and then you start planning the next.',
      },
    ],
    photoUrls: [
      photos.friendsToast,
      photos.nordicPlating,
      photos.nordicInterior,
      photos.tastingMenu,
    ],
    wineLabel: wineHarbourFire,
    wineLabels: [wineHarbourFire],
    reviewedBy: 'You',
    origin: 'own',
    overallScore: 4.8,
  },
  {
    id: 'demo-v4',
    restaurantId: 'demo-r4',
    date: '2026-05-02T21:15:00',
    generalComment:
      'Late-night Trastevere pasta. Tiny room, candlelight, pepper in the air — the kind of evening that feels stolen from a film.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 9,
        comment: 'Cacio e pepe done right — glossy, peppery, perfect.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 7,
        comment: 'House red in thick tumblers — honest and cold.',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 7,
        comment: 'Busy and a bit brusque, in a charming way.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 9,
        comment: 'Crowded tables, warm wood, street noise through the door.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 10,
        comment: 'Excellent for the price.',
      },
    ],
    photoUrls: [photos.friendsCheers, photos.pastaClose, photos.candleRestaurant],
    reviewedBy: 'You',
    origin: 'own',
    overallScore: 4.2,
  },
  {
    id: 'demo-v5',
    restaurantId: 'demo-r5',
    date: '2026-03-08T12:45:00',
    generalComment:
      'Quick Indonesian lunch by the canal before a meeting. Reliable rijsttafel, friendly chaos, and the smell of fried shallots on the street.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 7,
        comment: 'Solid rendang and sambal — comforting, not flashy.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 6,
        comment: 'Iced jasmine tea did the job.',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 7,
        comment: 'Fine for a busy lunch rush.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 6,
        comment: 'Touristy strip, but the upstairs room is quieter.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 8,
        comment: 'Filling and fair.',
      },
    ],
    photoUrls: [photos.tableTogether, photos.asianSpread, photos.vegetableCourse],
    reviewedBy: 'You',
    origin: 'own',
    overallScore: 3.4,
  },
  {
    id: 'demo-v6',
    restaurantId: 'demo-r6',
    date: '2026-02-20T20:00:00',
    generalComment:
      'Brussels bistro energy on Place Jourdan. Charred steak, crisp frites, and a dining room that buzzes without shouting. Exactly what you hope a neighbourhood classic feels like.',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 9,
        comment: 'Entrecôte with green peppercorn sauce — textbook.',
      },
      {
        id: 'drinks',
        title: 'Drinks',
        rating: 8,
        comment: 'Local blonde beer and a solid house Bordeaux.',
      },
      {
        id: 'service',
        title: 'Service',
        rating: 8,
        comment: 'Brisk, smiling, never makes you wait for the bill.',
      },
      {
        id: 'setting',
        title: 'Atmosphere',
        rating: 8,
        comment: 'Mirrors, brass, and the square glowing outside.',
      },
      {
        id: 'valueForMoney',
        title: 'Value for Money',
        rating: 8,
        comment: 'Fair for the quality.',
      },
    ],
    photoUrls: [
      photos.friendsLaughing,
      photos.steakPlate,
      photos.bistroInterior,
      photos.candleRestaurant,
    ],
    reviewedBy: 'You',
    origin: 'own',
    overallScore: 4.1,
  },
];

/** Legacy shipping seed IDs (pre–demo- prefix) still stripped on hydrate. */
const LEGACY_SEED_RESTAURANT_IDS = new Set([
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
]);
const LEGACY_SEED_REVIEW_IDS = new Set([
  'v1a',
  'v1b',
  'v2a',
  'v2b',
  'v3a',
  'v3b',
  'v4a',
  'v5a',
]);

export function isDemoRestaurantId(id: string): boolean {
  return id.startsWith('demo-') || LEGACY_SEED_RESTAURANT_IDS.has(id);
}

export function isDemoReviewId(id: string): boolean {
  return id.startsWith('demo-') || LEGACY_SEED_REVIEW_IDS.has(id);
}

const DEMO_RESTAURANT_IDS = new Set(mockRestaurants.map((r) => r.id));
const DEMO_REVIEW_IDS = new Set(mockReviews.map((r) => r.id));

function formatAbbreviated(iso: string): string {
  return formatAbbreviatedDate(iso);
}

export function getRestaurant(id: string): Restaurant | undefined {
  return mockRestaurants.find((r) => r.id === id);
}

export function getReview(id: string): Review | undefined {
  return mockReviews.find((r) => r.id === id);
}

export function getReviewsForRestaurant(
  restaurantId: string,
  origin?: ReviewOrigin,
): Review[] {
  return mockReviews
    .filter((r) => r.restaurantId === restaurantId)
    .filter((r) => (origin ? resolveReviewOrigin(r) === origin : true))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function getFeedSummaries(
  origin: ReviewOrigin = 'own',
): RestaurantVisitSummary[] {
  const summaries: RestaurantVisitSummary[] = [];

  for (const restaurant of mockRestaurants) {
    const visits = getReviewsForRestaurant(restaurant.id, origin);
    if (visits.length === 0) continue;
    const averageScore =
      visits.reduce((sum, v) => sum + v.overallScore, 0) / visits.length;
    const latestPhoto = visits[0].photoUrls[0] ?? restaurant.photoUrl;
    const reviewerNames = [
      ...new Set(visits.map((v) => v.reviewedBy.trim()).filter(Boolean)),
    ];
    summaries.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      city: restaurant.city,
      primaryType: restaurant.primaryType ?? '',
      averageScore,
      visitCount: visits.length,
      lastVisitDate: formatAbbreviated(visits[0].date),
      lastVisitAt: +new Date(visits[0].date),
      reviewerName:
        origin === 'imported' && reviewerNames.length > 0
          ? reviewerNames.join(', ')
          : undefined,
      thumbnailColor: restaurant.thumbnailColor,
      photoUrl: latestPhoto,
      isFavorite: restaurant.isFavorite,
      reviewIds: visits.map((v) => v.id),
    });
  }

  return summaries.sort((a, b) => {
    if (a.lastVisitAt !== b.lastVisitAt) return b.lastVisitAt - a.lastVisitAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function formatReviewDate(iso: string): string {
  return formatReviewDateTime(iso);
}

/**
 * Remove showcase / legacy shipping seed. Keeps anything the user created.
 *
 * If a user-created review still points at a demo restaurant (e.g. they added
 * their own visit to a showcase venue while it was visible), the restaurant is
 * kept — but it is "adopted" into a user id (demo-rN → user-…) so it stops
 * being detected as demo (no more Demo pill) while the user's review stays.
 */
export function stripShippingSeedData(
  restaurants: Restaurant[],
  reviews: Review[],
): { restaurants: Restaurant[]; reviews: Review[]; stripped: boolean } {
  const nextReviews = reviews.filter((r) => !isDemoReviewId(r.id));
  const keptRestaurantIds = new Set(nextReviews.map((r) => r.restaurantId));
  const demoOwnedByUser = new Set(
    restaurants
      .filter((r) => isDemoRestaurantId(r.id) && keptRestaurantIds.has(r.id))
      .map((r) => r.id),
  );
  const adoptId = (id: string): string =>
    demoOwnedByUser.has(id) ? `user-${id.replace(/^demo-/, '')}` : id;
  const nextRestaurants = restaurants
    .filter(
      (r) => !isDemoRestaurantId(r.id) || keptRestaurantIds.has(r.id),
    )
    .map((r) => (demoOwnedByUser.has(r.id) ? { ...r, id: adoptId(r.id) } : r));
  const rewrittenReviews = nextReviews.map((r) =>
    demoOwnedByUser.has(r.restaurantId)
      ? { ...r, restaurantId: adoptId(r.restaurantId) }
      : r,
  );
  const stripped =
    nextReviews.length !== reviews.length ||
    nextRestaurants.length !== restaurants.length ||
    demoOwnedByUser.size > 0;
  return {
    restaurants: nextRestaurants,
    reviews: rewrittenReviews,
    stripped,
  };
}

/** Alias — strip demo showcase before persist / backup / share. */
export function stripDemoShowcase(
  restaurants: Restaurant[],
  reviews: Review[],
): { restaurants: Restaurant[]; reviews: Review[] } {
  const cleaned = stripShippingSeedData(restaurants, reviews);
  return {
    restaurants: cleaned.restaurants,
    reviews: cleaned.reviews,
  };
}

/**
 * Merge showcase restaurants/reviews into user data (in-memory only).
 * Existing user rows win on ID collision.
 *
 * A user-adopted demo restaurant (demo-rN adopted as user-rN while the user
 * kept their own review) counts as the same venue: if user-rN exists, the
 * demo-rN showcase row is not added again, otherwise the venue would appear
 * twice once the showcase is re-enabled.
 */
export function mergeDemoShowcase(
  restaurants: Restaurant[],
  reviews: Review[],
): { restaurants: Restaurant[]; reviews: Review[] } {
  const restaurantIds = new Set(restaurants.map((r) => r.id));
  const adoptedDemoIds = new Set(
    restaurants
      .map((r) => /^user-(demo-)?(.+)$/.exec(r.id)?.[2])
      .filter((v): v is string => Boolean(v) && DEMO_RESTAURANT_IDS.has(`demo-${v}`)),
  );
  const reviewIds = new Set(reviews.map((r) => r.id));
  return {
    restaurants: [
      ...restaurants,
      ...mockRestaurants.filter(
        (r) =>
          !restaurantIds.has(r.id) &&
          !adoptedDemoIds.has(r.id.replace(/^demo-/, '')),
      ),
    ],
    reviews: [
      ...reviews,
      ...mockReviews.filter((r) => !reviewIds.has(r.id)),
    ],
  };
}

export function hasDemoShowcase(
  restaurants: Restaurant[],
  reviews: Review[],
): boolean {
  return (
    restaurants.some((r) => DEMO_RESTAURANT_IDS.has(r.id)) ||
    reviews.some((r) => DEMO_REVIEW_IDS.has(r.id))
  );
}
