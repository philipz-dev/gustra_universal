import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import type { Restaurant, Review } from '@/data/types';
import {
  normalizeRestaurant,
  resolveReviewOrigin,
} from '@/data/types';
import { standardCriterionStorageTitle } from '@/context/CriteriaSettings';
import {
  backupPhotoKey,
  ensurePhotosDirectory,
  localPhotoUri,
} from '@/services/backup/photos';
import type { RestaurantBackup } from '@/services/backup/types';
import {
  type SharePackage,
  type ShareReviewBackup,
} from '@/services/share/ReviewShareService';
import { SHARE_FILE_EXTENSION } from '@/services/share/types';
import { overallScoreFromCriteria } from '@/services/reviews/ratings';
import { rebuildSearchableText } from '@/services/reviews/searchableText';

/** Matches Swift `ReviewerProfile.maxNameLength`. */
const REVIEWER_MAX_NAME_LENGTH = 20;

function uriLooksLikeGustraShareFilename(uri: string): boolean {
  const clean = uri.split('?')[0]?.split('#')[0] ?? uri;
  return clean.toLowerCase().endsWith(`.${SHARE_FILE_EXTENSION}`);
}

export class ShareImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareImportError';
  }
}

function pushCriterion(
  criteria: Review['criteria'],
  id: string,
  title: string,
  rating: number | null | undefined,
  comment: string | null | undefined,
) {
  criteria.push({
    id,
    title,
    rating: typeof rating === 'number' ? rating : 0,
    comment: comment ?? '',
  });
}

function shareDateToApp(date: string | number | null | undefined): string {
  if (typeof date === 'number' && Number.isFinite(date)) {
    // Apple reference seconds (unlikely in share packages, but tolerate).
    const unix = date + 978307200;
    return new Date(unix * 1000).toISOString();
  }
  if (typeof date === 'string' && date.trim()) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function criteriaFromShareReview(item: ShareReviewBackup): Review['criteria'] {
  const criteria: Review['criteria'] = [];
  pushCriterion(criteria, 'food', 'Food', item.foodRating, item.foodComment);
  pushCriterion(
    criteria,
    'drinks',
    'Drinks',
    item.drinksRating,
    item.drinksComment,
  );
  pushCriterion(
    criteria,
    'service',
    'Service',
    item.serviceRating,
    item.serviceComment,
  );
  pushCriterion(
    criteria,
    'setting',
    'Atmosphere',
    item.settingRating,
    item.settingComment,
  );
  pushCriterion(
    criteria,
    'valueForMoney',
    'Value for Money',
    item.valueRating,
    item.valueComment,
  );

  if (item.customCriterionScoresJSON) {
    try {
      const parsed = JSON.parse(item.customCriterionScoresJSON) as {
        ratings?: Record<string, number>;
        comments?: Record<string, string>;
      };
      for (const [id, rating] of Object.entries(parsed.ratings ?? {})) {
        criteria.push({
          id,
          title: standardCriterionStorageTitle(id),
          rating,
          comment: parsed.comments?.[id] ?? '',
        });
      }
    } catch {
      // ignore malformed custom scores
    }
  }
  return criteria;
}

/** Swift `ReviewBackup.overallScore(using:)`. */
export function overallScoreFromShareReview(
  item: ShareReviewBackup,
  enabledCriterionIds?: Set<string>,
): number {
  const criteria = criteriaFromShareReview(item).filter((c) =>
    enabledCriterionIds ? enabledCriterionIds.has(c.id) : true,
  );
  return overallScoreFromCriteria(criteria);
}

function lookupPhotoBase64(
  photoFiles: Record<string, string>,
  path: string,
): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (photoFiles[trimmed]) return photoFiles[trimmed];
  const key = backupPhotoKey(trimmed);
  if (photoFiles[key]) return photoFiles[key];
  // Some exporters nest keys; match by filename suffix.
  for (const [k, v] of Object.entries(photoFiles)) {
    if (backupPhotoKey(k) === key) return v;
  }
  return null;
}

async function storeImportedPhoto(base64: string): Promise<string> {
  const dir = await ensurePhotosDirectory();
  const filename = `${Crypto.randomUUID()}.jpg`;
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return filename;
}

/**
 * Load a `.gustrashare` JSON package (Swift `ShareImportService.loadPackage`).
 */
export async function loadSharePackage(uri: string): Promise<SharePackage> {
  try {
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    // Known extension → trust and validate via parse/shape (no byte-window sniff).
    // Otherwise sniff identity markers only — never require `reviews`/`restaurants`
    // in a size-capped prefix (Swift puts a large `sharedByPhoto` before them).
    const namedPackage = uriLooksLikeGustraShareFilename(uri);
    if (!namedPackage && !peekLooksLikeSharePackage(raw)) {
      throw new ShareImportError('This is not a Gustra share file.');
    }
    let parsed: SharePackage;
    try {
      parsed = JSON.parse(raw) as SharePackage;
    } catch {
      throw new ShareImportError('This is not a Gustra share file.');
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.reviews) ||
      !Array.isArray(parsed.restaurants)
    ) {
      throw new ShareImportError('Could not read the shared reviews file.');
    }
    return {
      schemaVersion: parsed.schemaVersion ?? 2,
      appVersion: parsed.appVersion ?? '1.0',
      exportedAt: parsed.exportedAt ?? new Date().toISOString(),
      sharedBy: typeof parsed.sharedBy === 'string' ? parsed.sharedBy : '',
      sharedById:
        typeof parsed.sharedById === 'string' && parsed.sharedById.trim()
          ? parsed.sharedById.trim()
          : null,
      sharedByPhoto: parsed.sharedByPhoto ?? null,
      restaurants: parsed.restaurants,
      reviews: parsed.reviews,
      photoFiles: parsed.photoFiles ?? {},
    };
  } catch (error) {
    if (error instanceof ShareImportError) throw error;
    throw new ShareImportError('Could not read the shared reviews file.');
  }
}

/**
 * Cheap content sniff for WhatsApp/Mail rewrites (`.json` / no extension).
 *
 * Only checks identity keys that always appear near the start of a Gustra
 * package (`schemaVersion` + `sharedBy`), even when Swift places a multi‑MB
 * `sharedByPhoto` base64 before `restaurants` / `reviews`. Shape is validated
 * after `JSON.parse` in `loadSharePackage`.
 */
export function peekLooksLikeSharePackage(raw: string): boolean {
  const text = raw.replace(/^\uFEFF/, '').trimStart();
  if (!text.startsWith('{')) return false;
  // Identity fields sit before any photo blobs in both Swift and Expo order.
  const head = text.slice(0, 4096);
  return head.includes('"schemaVersion"') && head.includes('"sharedBy"');
}

export async function uriLooksLikeSharePackage(uri: string): Promise<boolean> {
  if (uriLooksLikeGustraShareFilename(uri)) return true;
  try {
    // Only the head is needed for identity sniff.
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
      length: 4096,
      position: 0,
    });
    return peekLooksLikeSharePackage(raw);
  } catch {
    try {
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return peekLooksLikeSharePackage(raw);
    } catch {
      return false;
    }
  }
}

export type ShareImportResult = {
  /** Restaurants to insert or replace by id. */
  restaurants: Restaurant[];
  /** Reviews to insert or replace by id. */
  reviews: Review[];
  /** Extra local review ids collapsed as duplicates of an upsert. */
  removeReviewIds: string[];
  /** Restaurants left with no visits after collapse. */
  removeRestaurantIds: string[];
  importedCount: number;
  updatedCount: number;
};

function visitDayKey(iso: string): string {
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  const raw = iso.trim();
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function hasCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/** ~120 m — same place across two share packages. */
function coordsNear(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  if (!hasCoordinates(a.latitude, a.longitude)) return false;
  if (!hasCoordinates(b.latitude, b.longitude)) return false;
  const dLat = (a.latitude - b.latitude) * 111_320;
  const midLat = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLng = (a.longitude - b.longitude) * 111_320 * Math.cos(midLat);
  return Math.hypot(dLat, dLng) <= 120;
}

function restaurantsMatch(
  existing: Restaurant,
  incoming: Pick<
    RestaurantBackup,
    'name' | 'city' | 'latitude' | 'longitude' | 'mapItemIdentifier'
  >,
): boolean {
  const mapA = existing.mapItemIdentifier?.trim();
  const mapB = incoming.mapItemIdentifier?.trim();
  if (mapA && mapB && mapA === mapB) return true;

  const nameA = existing.name.trim().toLowerCase();
  const nameB = (incoming.name ?? '').trim().toLowerCase();
  if (!nameA || !nameB || nameA !== nameB) return false;

  const cityA = existing.city.trim().toLowerCase();
  const cityB = (incoming.city ?? '').trim().toLowerCase();
  if (cityA && cityB && cityA === cityB) return true;

  if (
    coordsNear(existing, {
      latitude: incoming.latitude ?? 0,
      longitude: incoming.longitude ?? 0,
    })
  ) {
    return true;
  }

  return !cityA && !cityB;
}

function authorsMatch(
  existing: Review,
  reviewedById: string,
  reviewedBy: string,
): boolean {
  if (resolveReviewOrigin(existing) !== 'imported') return false;
  const exId = existing.reviewedById?.trim();
  const inId = reviewedById.trim();
  if (exId && inId && exId === inId) return true;
  // Name fallback: older packages minted a fresh author UUID per file, so
  // ids can differ for the same friend.
  const exName = existing.reviewedBy.trim().toLowerCase();
  const inName = reviewedBy.trim().toLowerCase();
  return Boolean(exName && inName && exName === inName);
}

function findMatchingExistingReviews(args: {
  existingReviews: Review[];
  existingRestaurants: Map<string, Restaurant>;
  sourceReviewId: string;
  reviewedById: string;
  reviewedBy: string;
  visitDay: string;
  packageRestaurant: RestaurantBackup | undefined;
}): Review[] {
  const {
    existingReviews,
    existingRestaurants,
    sourceReviewId,
    reviewedById,
    reviewedBy,
    visitDay,
    packageRestaurant,
  } = args;

  const bySource = existingReviews.filter((review) => {
    if (resolveReviewOrigin(review) !== 'imported') return false;
    const src = review.sourceReviewId?.trim();
    if (src && src === sourceReviewId) return true;
    return review.id === sourceReviewId;
  });
  if (bySource.length > 0) return bySource;

  if (!packageRestaurant) return [];

  return existingReviews.filter((review) => {
    if (!authorsMatch(review, reviewedById, reviewedBy)) return false;
    if (visitDayKey(review.date) !== visitDay) return false;
    const restaurant = existingRestaurants.get(review.restaurantId);
    if (!restaurant) return false;
    return restaurantsMatch(restaurant, packageRestaurant);
  });
}

function pickCanonicalReview(matches: Review[]): Review {
  return [...matches].sort((a, b) => {
    const photoDelta = b.photoUrls.length - a.photoUrls.length;
    if (photoDelta !== 0) return photoDelta;
    return b.date.localeCompare(a.date);
  })[0]!;
}

/**
 * Collapse already-stored friend duplicates (same author + day + place, or
 * same sourceReviewId). Keeps the visit with the most photos.
 */
export function planImportedReviewCollapse(
  reviews: Review[],
  restaurants: Restaurant[],
): { removeReviewIds: string[]; removeRestaurantIds: string[] } {
  const restaurantsById = new Map(restaurants.map((r) => [r.id, r]));
  const imported = reviews.filter(
    (r) => resolveReviewOrigin(r) === 'imported',
  );
  const removeReviewIds = new Set<string>();
  const claimed = new Set<string>();

  for (const review of imported) {
    if (claimed.has(review.id) || removeReviewIds.has(review.id)) continue;
    const restaurant = restaurantsById.get(review.restaurantId);
    if (!restaurant) continue;

    const cluster = imported.filter((other) => {
      if (other.id === review.id) return true;
      if (claimed.has(other.id) || removeReviewIds.has(other.id)) return false;
      const srcA = review.sourceReviewId?.trim();
      const srcB = other.sourceReviewId?.trim();
      if (srcA && srcB && srcA === srcB) return true;
      if (
        !authorsMatch(
          other,
          review.reviewedById?.trim() || '',
          review.reviewedBy,
        )
      ) {
        return false;
      }
      if (visitDayKey(other.date) !== visitDayKey(review.date)) return false;
      const otherRest = restaurantsById.get(other.restaurantId);
      if (!otherRest) return false;
      return restaurantsMatch(restaurant, {
        name: otherRest.name,
        city: otherRest.city,
        latitude: otherRest.latitude,
        longitude: otherRest.longitude,
        mapItemIdentifier: otherRest.mapItemIdentifier,
      });
    });

    const canonical = pickCanonicalReview(cluster);
    for (const match of cluster) {
      claimed.add(match.id);
      if (match.id !== canonical.id) removeReviewIds.add(match.id);
    }
  }

  const remainingByRestaurant = new Map<string, number>();
  for (const review of reviews) {
    if (removeReviewIds.has(review.id)) continue;
    remainingByRestaurant.set(
      review.restaurantId,
      (remainingByRestaurant.get(review.restaurantId) ?? 0) + 1,
    );
  }

  const removeRestaurantIds: string[] = [];
  for (const reviewId of removeReviewIds) {
    const dropped = reviews.find((r) => r.id === reviewId);
    if (!dropped) continue;
    if ((remainingByRestaurant.get(dropped.restaurantId) ?? 0) > 0) continue;
    removeRestaurantIds.push(dropped.restaurantId);
  }

  return {
    removeReviewIds: [...removeReviewIds],
    removeRestaurantIds,
  };
}

function findReusableRestaurant(args: {
  existingRestaurants: Restaurant[];
  packageRestaurant: RestaurantBackup;
  preferredId?: string;
}): Restaurant | undefined {
  const { existingRestaurants, packageRestaurant, preferredId } = args;
  if (preferredId) {
    const preferred = existingRestaurants.find((r) => r.id === preferredId);
    if (preferred && restaurantsMatch(preferred, packageRestaurant)) {
      return preferred;
    }
  }
  return existingRestaurants.find((r) =>
    restaurantsMatch(r, packageRestaurant),
  );
}

function restaurantFromBackup(
  backup: RestaurantBackup,
  previous?: Restaurant,
): Restaurant {
  return normalizeRestaurant({
    id: previous?.id ?? Crypto.randomUUID(),
    name: backup.name,
    city: backup.city,
    country: backup.country ?? previous?.country ?? '',
    address: backup.streetAddress ?? previous?.address ?? '',
    phone: backup.phoneNumber ?? previous?.phone,
    latitude: backup.latitude ?? previous?.latitude ?? 0,
    longitude: backup.longitude ?? previous?.longitude ?? 0,
    mapItemIdentifier:
      backup.mapItemIdentifier ?? previous?.mapItemIdentifier ?? null,
    isFavorite: previous?.isFavorite ?? false,
    primaryType: backup.primaryType ?? previous?.primaryType ?? '',
    thumbnailColor: previous?.thumbnailColor || '#3D6B52',
    photoUrl: previous?.photoUrl ?? '',
  });
}

/**
 * Import selected reviews, upserting when the same friend visit already exists
 * (source review id, or author + day + place). Newer package photos/ratings win.
 */
export async function importSelectedShareReviews(args: {
  reviewIds: string[];
  package: SharePackage;
  existingReviews?: Review[];
  existingRestaurants?: Restaurant[];
}): Promise<ShareImportResult> {
  const selectedIds = new Set(args.reviewIds.filter(Boolean));
  if (selectedIds.size === 0) {
    throw new ShareImportError('Select at least one review to import.');
  }

  const selectedReviews = args.package.reviews.filter((r) =>
    selectedIds.has(r.id),
  );
  if (selectedReviews.length === 0) {
    throw new ShareImportError('Select at least one review to import.');
  }

  const existingReviews = args.existingReviews ?? [];
  const existingRestaurants = args.existingRestaurants ?? [];
  const existingRestaurantsById = new Map(
    existingRestaurants.map((r) => [r.id, r]),
  );

  const restaurantsByOldId = new Map(
    args.package.restaurants.map((r) => [r.id, r]),
  );

  const neededPhotoPaths = new Set<string>();
  for (const review of selectedReviews) {
    for (const path of review.photoPaths ?? []) {
      if (path?.trim()) neededPhotoPaths.add(path.trim());
    }
    const reviewerPath = review.reviewedByPhotoPath?.trim();
    if (reviewerPath) neededPhotoPaths.add(reviewerPath);
  }

  const photoPathMap = new Map<string, string>();
  for (const oldPath of neededPhotoPaths) {
    const base64 = lookupPhotoBase64(args.package.photoFiles, oldPath);
    if (!base64) continue;
    photoPathMap.set(oldPath, await storeImportedPhoto(base64));
  }

  let sharedByPhotoPath: string | undefined;
  if (args.package.sharedByPhoto?.trim()) {
    sharedByPhotoPath = await storeImportedPhoto(
      args.package.sharedByPhoto.trim(),
    );
  }

  const sharedByTrimmed = args.package.sharedBy.trim();
  /** One id for this package when `sharedById` is missing (legacy Swift/Expo). */
  const packageAuthorId =
    args.package.sharedById?.trim() || Crypto.randomUUID();

  const upsertRestaurants = new Map<string, Restaurant>();
  const upsertReviews: Review[] = [];
  const removeReviewIds = new Set<string>();
  let importedCount = 0;
  let updatedCount = 0;

  // Avoid matching the same local review twice in one multi-select import.
  const claimedExistingIds = new Set<string>();

  for (const backup of selectedReviews) {
    const mappedPhotos = (backup.photoPaths ?? [])
      .map((path) => photoPathMap.get(path.trim()))
      .filter((p): p is string => Boolean(p));

    const authorFromBackup = (backup.reviewedBy ?? '').trim();
    const reviewedBySource = authorFromBackup || sharedByTrimmed;
    const reviewedBy = reviewedBySource.slice(0, REVIEWER_MAX_NAME_LENGTH);

    let reviewedByPhotoFilename = '';
    const oldReviewerPath = backup.reviewedByPhotoPath?.trim();
    if (oldReviewerPath && photoPathMap.has(oldReviewerPath)) {
      reviewedByPhotoFilename = photoPathMap.get(oldReviewerPath)!;
    } else if (!authorFromBackup || authorFromBackup === sharedByTrimmed) {
      reviewedByPhotoFilename = sharedByPhotoPath ?? '';
    }

    const perReviewAuthorId = backup.reviewedById?.trim();
    const reviewedById = perReviewAuthorId || packageAuthorId;
    const sourceReviewId =
      backup.sourceReviewId?.trim() || backup.id.trim() || Crypto.randomUUID();
    const visitDate = shareDateToApp(backup.date);
    const visitDay = visitDayKey(visitDate);
    const packageRestaurant = backup.restaurantID
      ? restaurantsByOldId.get(backup.restaurantID)
      : undefined;

    const matches = findMatchingExistingReviews({
      existingReviews: existingReviews.filter(
        (r) => !claimedExistingIds.has(r.id) && !removeReviewIds.has(r.id),
      ),
      existingRestaurants: existingRestaurantsById,
      sourceReviewId,
      reviewedById,
      reviewedBy,
      visitDay,
      packageRestaurant,
    });

    const canonical = matches.length > 0 ? pickCanonicalReview(matches) : null;
    for (const match of matches) {
      claimedExistingIds.add(match.id);
      if (canonical && match.id !== canonical.id) {
        removeReviewIds.add(match.id);
      }
    }

    let restaurant: Restaurant | undefined;
    if (packageRestaurant) {
      const reusable = findReusableRestaurant({
        existingRestaurants: [
          ...existingRestaurants,
          ...upsertRestaurants.values(),
        ],
        packageRestaurant,
        preferredId: canonical?.restaurantId,
      });
      restaurant = restaurantFromBackup(packageRestaurant, reusable);
      upsertRestaurants.set(restaurant.id, restaurant);
    } else if (canonical) {
      restaurant = existingRestaurantsById.get(canonical.restaurantId);
    }

    const criteria = criteriaFromShareReview(backup);
    const photoUrls = mappedPhotos.map((name) => localPhotoUri(name));
    const firstPhoto = photoUrls[0] ?? '';

    if (restaurant && firstPhoto) {
      restaurant = {
        ...restaurant,
        photoUrl: firstPhoto,
      };
      upsertRestaurants.set(restaurant.id, restaurant);
    }

    const generalComment = backup.generalComment ?? '';
    const searchableFromPackage = (backup.searchableText ?? '').trim();
    const review: Review = {
      id: canonical?.id ?? Crypto.randomUUID(),
      restaurantId: restaurant?.id ?? canonical?.restaurantId ?? '',
      date: visitDate,
      generalComment,
      criteria,
      photoUrls:
        photoUrls.length > 0 ? photoUrls : (canonical?.photoUrls ?? []),
      reviewedBy,
      reviewedById,
      reviewedByPhotoUrl: reviewedByPhotoFilename
        ? localPhotoUri(reviewedByPhotoFilename)
        : canonical?.reviewedByPhotoUrl,
      overallScore: overallScoreFromCriteria(criteria),
      origin: 'imported',
      searchableText:
        searchableFromPackage ||
        rebuildSearchableText({
          restaurant,
          generalComment,
          criteria,
        }),
      ocrText: canonical?.ocrText ?? '',
      wineLabel: canonical?.wineLabel,
      wineLabels: canonical?.wineLabels,
      sourceReviewId,
    };
    upsertReviews.push(review);

    if (canonical) updatedCount += 1;
    else importedCount += 1;
  }

  // Drop restaurants that only hosted removed duplicate visits.
  const remainingByRestaurant = new Map<string, number>();
  for (const review of existingReviews) {
    if (removeReviewIds.has(review.id)) continue;
    // Count will be replaced for upserted reviews below.
    if (upsertReviews.some((u) => u.id === review.id)) continue;
    remainingByRestaurant.set(
      review.restaurantId,
      (remainingByRestaurant.get(review.restaurantId) ?? 0) + 1,
    );
  }
  for (const review of upsertReviews) {
    remainingByRestaurant.set(
      review.restaurantId,
      (remainingByRestaurant.get(review.restaurantId) ?? 0) + 1,
    );
  }

  const removeRestaurantIds: string[] = [];
  for (const reviewId of removeReviewIds) {
    const dropped = existingReviews.find((r) => r.id === reviewId);
    if (!dropped) continue;
    const rid = dropped.restaurantId;
    if ((remainingByRestaurant.get(rid) ?? 0) > 0) continue;
    if (upsertRestaurants.has(rid)) continue;
    removeRestaurantIds.push(rid);
  }

  return {
    restaurants: [...upsertRestaurants.values()],
    reviews: upsertReviews,
    removeReviewIds: [...removeReviewIds],
    removeRestaurantIds,
    importedCount,
    updatedCount,
  };
}

export function isGustraShareFilename(name: string): boolean {
  return name.toLowerCase().endsWith(`.${SHARE_FILE_EXTENSION}`);
}
