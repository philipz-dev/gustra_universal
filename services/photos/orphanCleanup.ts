import * as FileSystem from 'expo-file-system/legacy';

import type { Review } from '@/data/types';
import {
  backupPhotoKey,
  isRemotePhotoUrl,
  photosDirectory,
} from '@/services/backup/photos';

/**
 * Filenames under `Photos/` still referenced by persisted reviews
 * — Swift `ImageCompressionService.referencedPhotoPaths`.
 */
export function referencedPhotoFilenames(reviews: Review[]): Set<string> {
  const paths = new Set<string>();

  const add = (raw: string | undefined | null) => {
    const trimmed = raw?.trim();
    if (!trimmed || isRemotePhotoUrl(trimmed)) return;
    const key = backupPhotoKey(trimmed);
    if (!key || key.includes('..')) return;
    paths.add(key);
  };

  for (const review of reviews) {
    for (const url of review.photoUrls) add(url);
    add(review.reviewedByPhotoUrl);
  }

  return paths;
}

/**
 * Removes unreferenced JPGs from the Photos directory
 * — Swift `ImageCompressionService.removeOrphanedPhotos`.
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
      const lower = name.toLowerCase();
      if (!lower.endsWith('.jpg') && !lower.endsWith('.jpeg')) return;
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
 * Disk-side startup maintenance: prune orphan review photos
 * — Swift `ImageCompressionService.performStartupPhotoMaintenance`
 * (compression migration is handled separately via PhotoQualitySettings).
 */
export async function performStartupPhotoMaintenance(
  reviews: Review[],
): Promise<void> {
  const referenced = referencedPhotoFilenames(reviews);
  await removeOrphanedPhotos(referenced);
}
