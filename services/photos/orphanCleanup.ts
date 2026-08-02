import * as FileSystem from 'expo-file-system/legacy';

import type { Restaurant, Review } from '@/data/types';
import {
  backupPhotoKey,
  isRemotePhotoUrl,
  photosDirectory,
  resolveLocalPhotoUri,
} from '@/services/backup/photos';

const MEDIA_EXT = /\.(jpe?g|png|heic|heif|webp)$/i;

function profileDirectory(): string | null {
  const root = FileSystem.documentDirectory;
  return root ? `${root}Profile/` : null;
}

/**
 * Filenames under `Photos/` still referenced by persisted reviews / covers
 * — Swift `ImageCompressionService.referencedPhotoPaths`.
 */
export function referencedPhotoFilenames(
  reviews: Review[],
  restaurants: Restaurant[] = [],
): Set<string> {
  const paths = new Set<string>();

  const add = (raw: string | undefined | null) => {
    const trimmed = raw?.trim();
    if (!trimmed || isRemotePhotoUrl(trimmed)) return;
    const key = backupPhotoKey(trimmed);
    if (!key || key.includes('..') || key.includes('/')) return;
    paths.add(key);
  };

  for (const review of reviews) {
    for (const url of review.photoUrls) add(url);
    add(review.reviewedByPhotoUrl);
    add(review.wineLabel?.labelPhotoUri);
    for (const wine of review.wineLabels ?? []) {
      add(wine.labelPhotoUri);
    }
  }
  for (const restaurant of restaurants) {
    add(restaurant.photoUrl);
  }

  return paths;
}

/**
 * Removes unreferenced media files from the Photos directory
 * — Swift `ImageCompressionService.removeOrphanedPhotos` (extended for
 * png/heic left by Swift recovery copies).
 */
export async function removeOrphanedPhotos(
  referencedPaths: Set<string>,
): Promise<number> {
  const dir = photosDirectory();
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return 0;
  } catch {
    return 0;
  }

  let removed = 0;
  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return 0;
  }

  await Promise.all(
    names.map(async (name) => {
      if (name.startsWith('.')) return;
      if (!MEDIA_EXT.test(name)) return;
      if (referencedPaths.has(name)) return;
      try {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
        removed += 1;
      } catch {
        // ignore missing / locked files
      }
    }),
  );

  return removed;
}

/**
 * Drop stray files under Profile/ (keep only `reviewer.jpg` when present).
 * When `keepReviewerPhoto` is false, also remove `reviewer.jpg`.
 */
export async function pruneProfileDirectory(
  keepReviewerPhoto: boolean,
): Promise<number> {
  const dir = profileDirectory();
  if (!dir) return 0;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return 0;
  } catch {
    return 0;
  }

  let removed = 0;
  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return 0;
  }

  await Promise.all(
    names.map(async (name) => {
      if (name.startsWith('.')) return;
      if (keepReviewerPhoto && name === 'reviewer.jpg') return;
      try {
        const path = `${dir}${name}`;
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (!fileInfo.exists || fileInfo.isDirectory) return;
        await FileSystem.deleteAsync(path, { idempotent: true });
        removed += 1;
      } catch {
        // ignore
      }
    }),
  );

  return removed;
}

/**
 * Resolve one persisted photo ref to a readable file URI, or `null` when the
 * file is gone. Remote (demo/showcase) URLs are always kept.
 */
async function existingOrNull(raw: string | undefined | null): Promise<string | null> {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (isRemotePhotoUrl(trimmed)) return trimmed;
  return resolveLocalPhotoUri(trimmed);
}

/**
 * Remove review/restaurant photo references whose file no longer exists on
 * disk ("broken refs" — e.g. an orphaned path after a restore or sandbox
 * change). Remote mock URLs are preserved. Returns the cleaned dataset plus
 * how many refs were dropped so callers can decide whether to persist.
 */
export async function pruneBrokenPhotoRefs(data: {
  reviews: Review[];
  restaurants: Restaurant[];
}): Promise<{
  reviews: Review[];
  restaurants: Restaurant[];
  removedRefs: number;
}> {
  let removedRefs = 0;
  const reviews: Review[] = [];
  for (const review of data.reviews) {
    const kept: string[] = [];
    for (const raw of review.photoUrls ?? []) {
      const existing = await existingOrNull(raw);
      if (existing) kept.push(existing);
      else removedRefs += 1;
    }
    const cleaned =
      kept.length === (review.photoUrls ?? []).length
        ? review
        : { ...review, photoUrls: kept };
    reviews.push(cleaned);
  }

  const restaurants: Restaurant[] = [];
  for (const restaurant of data.restaurants) {
    const raw = restaurant.photoUrl?.trim();
    if (!raw || isRemotePhotoUrl(raw)) {
      restaurants.push(restaurant);
      continue;
    }
    const existing = await resolveLocalPhotoUri(raw);
    if (existing) {
      restaurants.push(
        existing === raw ? restaurant : { ...restaurant, photoUrl: existing },
      );
    } else {
      removedRefs += 1;
      restaurants.push({ ...restaurant, photoUrl: '' });
    }
  }

  return { reviews, restaurants, removedRefs };
}

/**
 * Disk-side startup maintenance: prune orphan review + profile photos
 * — Swift `ImageCompressionService.performStartupPhotoMaintenance`
 * (compression migration is handled separately via PhotoQualitySettings).
 */
export async function performStartupPhotoMaintenance(
  reviews: Review[],
  options?: {
    restaurants?: Restaurant[];
    /** When false, delete Profile/reviewer.jpg too. Default: keep if present. */
    keepProfilePhoto?: boolean;
  },
): Promise<void> {
  const referenced = referencedPhotoFilenames(
    reviews,
    options?.restaurants ?? [],
  );
  await removeOrphanedPhotos(referenced);
  if (options?.keepProfilePhoto === false) {
    await pruneProfileDirectory(false);
  } else {
    // Still remove stray non-reviewer files under Profile/.
    await pruneProfileDirectory(true);
  }
}
