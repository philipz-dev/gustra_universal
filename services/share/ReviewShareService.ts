import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { Restaurant, Review } from '@/data/types';
import {
  restaurantToBackup,
  reviewToBackup,
} from '@/services/backup/mapping';
import type {
  RestaurantBackup,
  ReviewBackup,
} from '@/services/backup/types';
import {
  SHARE_FILE_EXTENSION,
  SHARE_SCHEMA_VERSION,
  SHARE_UTI,
  toShareIso8601,
} from '@/services/share/types';

export type ShareReviewBackup = Omit<ReviewBackup, 'date'> & {
  /** ISO-8601 string (Swift share encoder uses `.iso8601`). */
  date: string;
};

/** Matches Swift `SharePackage`. */
export type SharePackage = {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  sharedBy: string;
  sharedByPhoto: string | null;
  restaurants: RestaurantBackup[];
  reviews: ShareReviewBackup[];
  photoFiles: Record<string, string>;
};

function photosDirectory(): string | null {
  const root = FileSystem.documentDirectory;
  if (!root) return null;
  return `${root}Photos/`;
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Swift `UUID` decoding requires RFC UUID strings — remap short mock ids. */
function mappedId(id: string, map: Map<string, string>): string {
  const existing = map.get(id);
  if (existing) return existing;
  const next = isUuidString(id) ? id : Crypto.randomUUID();
  map.set(id, next);
  return next;
}

function reviewToShareBackup(
  review: Review,
  idMap: Map<string, string>,
): ShareReviewBackup {
  const backup = reviewToBackup(review);
  return {
    ...backup,
    id: mappedId(review.id, idMap),
    restaurantID: review.restaurantId
      ? mappedId(review.restaurantId, idMap)
      : null,
    date: toShareIso8601(review.date),
  };
}

async function readLocalPhotoBase64(path: string): Promise<string | null> {
  const candidates: string[] = [];
  if (path.startsWith('file://') || path.startsWith('/')) {
    candidates.push(path);
  } else {
    const photos = photosDirectory();
    if (photos) candidates.push(`${photos}${path}`);
    const root = FileSystem.documentDirectory;
    if (root) candidates.push(`${root}${path}`);
  }

  for (const uri of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || info.isDirectory) continue;
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function makeSharePackage(args: {
  reviews: Review[];
  restaurants: Restaurant[];
  sharedBy: string;
  sharedByPhotoBase64?: string | null;
  appVersion?: string;
}): SharePackage {
  const restaurantsById = new Map(
    args.restaurants.map((restaurant) => [restaurant.id, restaurant]),
  );
  const idMap = new Map<string, string>();
  const usedRestaurants = new Map<string, RestaurantBackup>();
  const reviews: ShareReviewBackup[] = [];

  for (const review of args.reviews) {
    reviews.push(reviewToShareBackup(review, idMap));
    const restaurant = restaurantsById.get(review.restaurantId);
    if (restaurant) {
      const shareRestaurantId = mappedId(restaurant.id, idMap);
      if (!usedRestaurants.has(shareRestaurantId)) {
        usedRestaurants.set(shareRestaurantId, {
          ...restaurantToBackup(restaurant),
          id: shareRestaurantId,
        });
      }
    }
  }

  const appVersion =
    args.appVersion ??
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    '1.0.0';

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    appVersion,
    exportedAt: toShareIso8601(new Date()),
    sharedBy: args.sharedBy.trim(),
    sharedByPhoto: args.sharedByPhotoBase64 ?? null,
    restaurants: [...usedRestaurants.values()],
    reviews,
    photoFiles: {},
  };
}

async function attachLocalPhotos(packageData: SharePackage): Promise<void> {
  const paths = new Set<string>();
  for (const review of packageData.reviews) {
    for (const path of review.photoPaths) paths.add(path);
    if (review.reviewedByPhotoPath) paths.add(review.reviewedByPhotoPath);
  }

  for (const path of paths) {
    if (packageData.photoFiles[path]) continue;
    const base64 = await readLocalPhotoBase64(path);
    if (base64) packageData.photoFiles[path] = base64;
  }
}

export function makeShareFilename(sharedBy: string): string {
  const safe = sharedBy
    .trim()
    .replace(/\//g, '-')
    .replace(/\s+/g, ' ');
  const base = safe.length > 0 ? safe : 'share';
  return `${base}.${SHARE_FILE_EXTENSION}`;
}

export async function writeSharePackageFile(
  packageData: SharePackage,
): Promise<{ uri: string; filename: string }> {
  await attachLocalPhotos(packageData);

  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) {
    throw new Error('Could not prepare the shared reviews file.');
  }

  const filename = makeShareFilename(packageData.sharedBy);
  const uri = `${cacheRoot}${filename}`;
  const json = JSON.stringify(packageData);
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { uri, filename };
}

/**
 * Build a `.gustrashare` package and present the system share sheet
 * (Swift `ReviewShareService` + `ShareSheetPresenter` for list shares).
 */
export async function shareReviewsPackage(args: {
  reviews: Review[];
  restaurants: Restaurant[];
  sharedBy: string;
  sharedByPhotoBase64?: string | null;
}): Promise<string> {
  if (args.reviews.length === 0) {
    throw new Error('Select at least one review to share.');
  }

  const packageData = makeSharePackage(args);
  const { uri, filename } = await writeSharePackageFile(packageData);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Share Gustra reviews',
    UTI: SHARE_UTI,
  });

  return filename;
}
