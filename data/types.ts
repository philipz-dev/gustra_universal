export type SatisfactionLevel = 'excellent' | 'neutral' | 'avoid';

/** Matches Swift `ReviewOrigin`. */
export type ReviewOrigin = 'own' | 'imported';

export type CriterionRating = {
  id: string;
  title: string;
  /**
   * Half-star steps (Swift `RatingValue`): `0` unrated, `-1` N/A,
   * `1…10` where `2` = 1.0★ and `10` = 5.0★.
   */
  rating: number;
  comment: string;
};

export type Restaurant = {
  id: string;
  name: string;
  city: string;
  /** Country name (Swift `Restaurant.country`). */
  country: string;
  /** Street / formatted address (Swift `streetAddress`). */
  address: string;
  phone?: string;
  /** WGS84 latitude (Swift `latitude`). */
  latitude: number;
  /** WGS84 longitude (Swift `longitude`). */
  longitude: number;
  /** Google Place ID when known (Swift `mapItemIdentifier`). */
  mapItemIdentifier?: string | null;
  /**
   * Google Places primary type, e.g. `italian_restaurant`
   * (Swift `primaryType`; used by cuisine filter).
   */
  primaryType: string;
  isFavorite: boolean;
  thumbnailColor: string;
  /** Dish or interior photo for feed cards. */
  photoUrl: string;
};

/** Fill missing place fields from older persisted records. */
export function normalizeRestaurant(restaurant: Restaurant): Restaurant {
  return {
    ...restaurant,
    country: restaurant.country ?? '',
    address: restaurant.address ?? '',
    latitude:
      typeof restaurant.latitude === 'number' && Number.isFinite(restaurant.latitude)
        ? restaurant.latitude
        : 0,
    longitude:
      typeof restaurant.longitude === 'number' &&
      Number.isFinite(restaurant.longitude)
        ? restaurant.longitude
        : 0,
    mapItemIdentifier: restaurant.mapItemIdentifier ?? null,
    primaryType: restaurant.primaryType ?? '',
    phone: restaurant.phone,
    isFavorite: Boolean(restaurant.isFavorite),
    thumbnailColor: restaurant.thumbnailColor || '#3D6B52',
    photoUrl: restaurant.photoUrl ?? '',
  };
}

export type Review = {
  id: string;
  restaurantId: string;
  date: string;
  generalComment: string;
  criteria: CriterionRating[];
  /** Hero photos on the detail screen. */
  photoUrls: string[];
  reviewedBy: string;
  /**
   * Local/remote URI for the reviewer avatar (Swift `reviewedByPhotoPath`).
   * Empty when unknown — detail falls back to letter or owner profile photo.
   */
  reviewedByPhotoUrl?: string;
  overallScore: number;
  /** `own` = app owner; `imported` = friends' shared reviews (Swift). */
  origin: ReviewOrigin;
  /**
   * Feed search blob: restaurant fields + comments + OCR
   * (Swift `Review.searchableText`).
   */
  searchableText?: string;
  /**
   * Photo OCR text kept separately so comment edits can rebuild search
   * without re-running Vision/ML Kit.
   */
  ocrText?: string;
};

/** Legacy backfill: non-empty `reviewedBy` ⇒ imported (Swift migrate). */
export function resolveReviewOrigin(
  review: Pick<Review, 'origin' | 'reviewedBy'>,
): ReviewOrigin {
  if (review.origin === 'own' || review.origin === 'imported') {
    return review.origin;
  }
  return review.reviewedBy.trim() ? 'imported' : 'own';
}

export type RestaurantVisitSummary = {
  restaurantId: string;
  name: string;
  city: string;
  /** Google Places primary type for cuisine filter. */
  primaryType: string;
  averageScore: number;
  visitCount: number;
  /** Display label (abbreviated). */
  lastVisitDate: string;
  /** Epoch ms of most recent visit — used for default date sort. */
  lastVisitAt: number;
  reviewerName?: string;
  thumbnailColor: string;
  photoUrl: string;
  isFavorite: boolean;
  reviewIds: string[];
};

export function satisfactionFromScore(score: number): SatisfactionLevel {
  if (score >= 4) return 'excellent';
  if (score >= 2.5) return 'neutral';
  return 'avoid';
}
