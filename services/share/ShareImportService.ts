import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import type { Restaurant, Review } from '@/data/types';
import { normalizeRestaurant } from '@/data/types';
import {
  backupPhotoKey,
  ensurePhotosDirectory,
  localPhotoUri,
} from '@/services/backup/photos';
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
          title: 'Custom',
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
  restaurants: Restaurant[];
  reviews: Review[];
  importedCount: number;
};

/**
 * Import selected reviews as new imported entities with remapped IDs/photos
 * (Swift `ShareImportService.importSelected`).
 */
export async function importSelectedShareReviews(args: {
  reviewIds: string[];
  package: SharePackage;
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

  const restaurantIds = new Set(
    selectedReviews
      .map((r) => r.restaurantID)
      .filter((id): id is string => Boolean(id)),
  );
  const restaurantsByOldId = new Map(
    args.package.restaurants
      .filter((r) => restaurantIds.has(r.id))
      .map((r) => [r.id, r]),
  );

  const restaurantIdMap = new Map<string, Restaurant>();
  const restaurants: Restaurant[] = [];

  for (const [oldId, backup] of restaurantsByOldId) {
    const restaurant = normalizeRestaurant({
      id: Crypto.randomUUID(),
      name: backup.name,
      city: backup.city,
      country: backup.country ?? '',
      address: backup.streetAddress ?? '',
      phone: backup.phoneNumber ?? undefined,
      latitude: backup.latitude ?? 0,
      longitude: backup.longitude ?? 0,
      mapItemIdentifier: backup.mapItemIdentifier ?? null,
      isFavorite: false,
      primaryType: backup.primaryType ?? '',
      thumbnailColor: '#3D6B52',
      photoUrl: '',
    });
    restaurantIdMap.set(oldId, restaurant);
    restaurants.push(restaurant);
  }

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
  const reviews: Review[] = [];

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
    } else if (
      !authorFromBackup ||
      authorFromBackup === sharedByTrimmed
    ) {
      reviewedByPhotoFilename = sharedByPhotoPath ?? '';
    }

    const perReviewAuthorId = backup.reviewedById?.trim();
    const reviewedById = perReviewAuthorId || packageAuthorId;

    const restaurant = backup.restaurantID
      ? restaurantIdMap.get(backup.restaurantID)
      : undefined;

    const criteria = criteriaFromShareReview(backup);
    const photoUrls = mappedPhotos.map((name) => localPhotoUri(name));
    const firstPhoto = photoUrls[0] ?? '';

    if (restaurant && firstPhoto && !restaurant.photoUrl) {
      restaurant.photoUrl = firstPhoto;
    }

    const generalComment = backup.generalComment ?? '';
    const searchableFromPackage = (backup.searchableText ?? '').trim();
    reviews.push({
      id: Crypto.randomUUID(),
      restaurantId: restaurant?.id ?? '',
      date: shareDateToApp(backup.date),
      generalComment,
      criteria,
      photoUrls,
      reviewedBy,
      reviewedById,
      reviewedByPhotoUrl: reviewedByPhotoFilename
        ? localPhotoUri(reviewedByPhotoFilename)
        : undefined,
      overallScore: overallScoreFromCriteria(criteria),
      origin: 'imported',
      searchableText:
        searchableFromPackage ||
        rebuildSearchableText({
          restaurant,
          generalComment,
          criteria,
        }),
      ocrText: '',
    });
  }

  return {
    restaurants,
    reviews,
    importedCount: selectedReviews.length,
  };
}

export function isGustraShareFilename(name: string): boolean {
  return name.toLowerCase().endsWith(`.${SHARE_FILE_EXTENSION}`);
}
