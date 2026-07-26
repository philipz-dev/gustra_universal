export type SatisfactionLevel = 'excellent' | 'neutral' | 'avoid';

/** Matches Swift `ReviewOrigin`. */
export type ReviewOrigin = 'own' | 'imported';

/** Structured wine-label fiche (Gemini Vision); optional on older reviews. */
export type WineLabelFiche = {
  labelPhotoUri: string;
  nameAndEstate: string;
  typeStyle?: string;
  countryRegion?: string;
  vintage?: string | null;
  grapes?: string | null;
  alcoholPercent?: number | null;
  foodPairings?: string | null;
  analyzedAt?: string;
};

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
   * Stable author identity (UUID). Distinguishes people with the same display
   * name across shares. Set on import from package `sharedById` (or per-review).
   * Absent on older data — use `reviewerFilterKey()` for grouping.
   */
  reviewedById?: string;
  /**
   * Local/remote URI for the reviewer avatar (Swift `reviewedByPhotoPath`).
   * Empty when unknown — detail uses a letter avatar (never the device profile
   * photo for imported friends).
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
  /**
   * Gemini wine-label fiche (additive). Absent on older reviews / no match.
   */
  wineLabel?: WineLabelFiche | null;
  /**
   * Original review id from a `.gustrashare` package (friend's UUID).
   * Used to upsert on re-import instead of creating duplicates. Absent on
   * older imports / own reviews.
   */
  sourceReviewId?: string;
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

/**
 * Avatar URI for review detail.
 * Friends: only `reviewedByPhotoUrl`. Never fall back to the device profile photo.
 * Own visits with a display name: optional owner profile photo.
 */
export function resolveReviewerAvatarUri(
  review: Pick<
    Review,
    'origin' | 'reviewedBy' | 'reviewedByPhotoUrl'
  >,
  ownerProfilePhotoUri?: string | null,
): string | null {
  const embedded = review.reviewedByPhotoUrl?.trim();
  if (embedded) return embedded;
  if (
    resolveReviewOrigin(review) === 'own' &&
    review.reviewedBy.trim() &&
    ownerProfilePhotoUri?.trim()
  ) {
    return ownerProfilePhotoUri.trim();
  }
  return null;
}

/**
 * Stable key for filtering / grouping reviewers (same display name ≠ same person).
 * Prefer `reviewedById`; legacy falls back to name + photo URI.
 */
export function reviewerFilterKey(
  review: Pick<Review, 'reviewedBy' | 'reviewedById' | 'reviewedByPhotoUrl'>,
): string {
  const id = review.reviewedById?.trim();
  if (id) return `id:${id}`;
  const name = review.reviewedBy.trim().toLowerCase();
  const photo = (review.reviewedByPhotoUrl ?? '').trim();
  return `legacy:${name}\u0000${photo}`;
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
