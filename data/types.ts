export type SatisfactionLevel = 'excellent' | 'neutral' | 'avoid';

/** Matches Swift `ReviewOrigin`. */
export type ReviewOrigin = 'own' | 'imported';

/** Canonical tasting scales from Vision (localized in UI). */
export type WineTastingTraitKey =
  | 'freshness' // legacy dual-read; no longer requested or shown in Smaakprofiel
  | 'tannins'
  | 'body'
  | 'acidity'
  | 'sweetness';

/** 1–5 intensity; absent/null when Vision cannot judge. */
export type WineTastingTrait = {
  key: WineTastingTraitKey;
  /** Integer 1…5 */
  score: number;
};

/** Single grape in a blend (additive; older fiches may only have string lists). */
export type WineGrapeBlend = {
  name: string;
  /** 1…100 when known from the label; omit when unknown — never invent. */
  percent?: number;
};

/** Vision confidence for the optional taste-profile block (not the identity chip). */
export type WineTasteProfileConfidence = 'high' | 'medium' | 'low';

/** Structured wine-label fiche (Gemini Vision); optional on older reviews. */
export type WineLabelFiche = {
  labelPhotoUri: string;
  nameAndEstate: string;
  /**
   * Prefer stable codes: `red` | `white` | `rose` | `sparkling` | `fortified` | `orange`.
   * Older scans may store `dessert` or a localized free-text label (e.g. `Rood`).
   */
  typeStyle?: string;
  countryRegion?: string;
  vintage?: string | null;
  /** Display / legacy join of grape names. */
  grapes?: string | null;
  /**
   * Individual grape varieties for filter/search (additive).
   * Older fiches may only have `grapes`.
   */
  grapeVarieties?: string[];
  /**
   * Ordered blend with optional % (additive). Prefer for Smaakprofiel display.
   */
  grapeBlend?: WineGrapeBlend[];
  alcoholPercent?: number | null;
  foodPairings?: string | null;
  /** Additive tasting scales (older fiches omit this). */
  tastingTraits?: WineTastingTrait[];
  /** Serve / cellar hints from Vision (localized; omit when unknown). */
  servingTempHint?: string | null;
  aerationHint?: string | null;
  drinkWindowHint?: string | null;
  /**
   * Confidence for showing the taste-profile block. `low` → hide section.
   * Older fiches omit this (UI falls back to content heuristics).
   */
  tasteProfileConfidence?: WineTasteProfileConfidence;
  analyzedAt?: string;
  /**
   * User star rating for this bottle (half-star steps 1…10).
   * Additive — older fiches omit this; when present it drives Drinks average.
   */
  userRating?: number;
  /** Optional user notes for this bottle (additive). */
  userComment?: string;
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
   * Prefer `wineLabels` when present; keep this as the first/primary wine for
   * older clients and backups that only know a singular fiche.
   */
  wineLabel?: WineLabelFiche | null;
  /**
   * Ordered wine fiches for this visit (additive). Dual-read with `wineLabel`
   * via `wineLabelsForReview()`. Older data may only have `wineLabel`.
   */
  wineLabels?: WineLabelFiche[];
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
  /**
   * True when every visit for this restaurant is still a draft
   * (no criterion stars and/or unrated wine). Additive — older clients ignore.
   */
  isDraft?: boolean;
  /** Newest draft review id when `isDraft` (for open-in-edit). */
  draftReviewId?: string;
};

export function satisfactionFromScore(score: number): SatisfactionLevel {
  if (score >= 4) return 'excellent';
  if (score >= 2.5) return 'neutral';
  return 'avoid';
}
