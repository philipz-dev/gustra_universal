import * as FileSystem from 'expo-file-system/legacy';

import type { Restaurant, Review, WineLabelFiche } from '@/data/types';
import { REVIEWER_PHOTO_BACKUP_KEY } from '@/services/backup/types';
import { wineLabelsForReview } from '@/services/wine/wineLabelTypes';

/** Drop review gallery URIs that belong to wine-label fiche photos. */
export function stripWineLabelUrisFromPhotoUrls(
  photoUrls: string[],
  labels: WineLabelFiche[],
): string[] {
  const banned = new Set<string>();
  for (const label of labels) {
    const raw = label.labelPhotoUri?.trim();
    if (!raw) continue;
    banned.add(raw);
    banned.add(relocateLocalPhotoRef(raw));
    const key = backupPhotoKey(raw);
    if (key) banned.add(key);
  }
  // Always compact empties — a blank slot at [0] leaves Cover empty and
  // pushes the next real photo to "photo 2".
  return photoUrls.filter((uri) => {
    const trimmed = uri?.trim();
    if (!trimmed) return false;
    if (banned.size === 0) return true;
    if (banned.has(trimmed)) return false;
    if (banned.has(relocateLocalPhotoRef(trimmed))) return false;
    const key = backupPhotoKey(trimmed);
    if (key && banned.has(key)) return false;
    return true;
  });
}

/** Swift `ImageCompressionService.photosDirectory`. */
export function photosDirectory(): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Document directory unavailable');
  return `${root}Photos/`;
}

export async function ensurePhotosDirectory(): Promise<string> {
  const dir = photosDirectory();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export function isRemotePhotoUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Backup / Swift key: filename only (e.g. `uuid.jpg`). */
export function backupPhotoKey(pathOrUri: string): string {
  const clean = pathOrUri.trim().split('?')[0] ?? pathOrUri.trim();
  const segments = clean.split('/').filter(Boolean);
  return segments[segments.length - 1] || clean;
}

export function localPhotoUri(backupKey: string): string {
  return `${photosDirectory()}${backupKey}`;
}

/**
 * Rewrite a persisted local photo ref to the current app sandbox path.
 *
 * Absolute `file://` / `/…` URIs often break after an app update when the
 * Documents container UUID changes; files under `Photos/` keep the same name.
 * Remote http(s) URLs and empty strings are unchanged. Idempotent when the
 * ref already points at the current sandbox.
 */
export function relocateLocalPhotoRef(pathOrUri: string): string {
  const trimmed = pathOrUri.trim();
  if (!trimmed || isRemotePhotoUrl(trimmed)) return trimmed;

  const root = FileSystem.documentDirectory;
  if (!root) return trimmed;

  const key = backupPhotoKey(trimmed);
  if (!key || key.includes('..') || key.includes('/')) return trimmed;

  // Owner / profile avatar style paths stay under Profile/.
  if (/\/Profile\//i.test(trimmed)) {
    return `${root}Profile/${key}`;
  }

  try {
    return `${photosDirectory()}${key}`;
  } catch {
    return trimmed;
  }
}

/** Remap restaurant cover + every review photo / wine-label / friend avatar ref. */
export function relocateStoredPhotoRefs(data: {
  restaurants: Restaurant[];
  reviews: Review[];
}): { restaurants: Restaurant[]; reviews: Review[]; changed: boolean } {
  let changed = false;

  const restaurants = data.restaurants.map((restaurant) => {
    const photoUrl = relocateLocalPhotoRef(restaurant.photoUrl ?? '');
    if (photoUrl === (restaurant.photoUrl ?? '')) return restaurant;
    changed = true;
    return { ...restaurant, photoUrl };
  });

  const reviews = data.reviews.map((review) => {
    let next = review;
    const photoUrls = (review.photoUrls ?? []).map(relocateLocalPhotoRef);
    if (
      photoUrls.length !== (review.photoUrls ?? []).length ||
      photoUrls.some((uri, i) => uri !== review.photoUrls[i])
    ) {
      changed = true;
      next = { ...next, photoUrls };
    }

    const reviewedByPhotoUrl = review.reviewedByPhotoUrl?.trim()
      ? relocateLocalPhotoRef(review.reviewedByPhotoUrl)
      : review.reviewedByPhotoUrl;
    if (reviewedByPhotoUrl !== review.reviewedByPhotoUrl) {
      changed = true;
      next = { ...next, reviewedByPhotoUrl };
    }

    const labelRaw = review.wineLabel?.labelPhotoUri?.trim();
    if (review.wineLabel && labelRaw) {
      const labelPhotoUri = relocateLocalPhotoRef(labelRaw);
      if (labelPhotoUri !== review.wineLabel.labelPhotoUri) {
        changed = true;
        next = {
          ...next,
          wineLabel: { ...review.wineLabel, labelPhotoUri },
        };
      }
    }

    if (Array.isArray(review.wineLabels) && review.wineLabels.length > 0) {
      let labelsChanged = false;
      const wineLabels = review.wineLabels.map((wine) => {
        const raw = wine.labelPhotoUri?.trim();
        if (!raw) return wine;
        const labelPhotoUri = relocateLocalPhotoRef(raw);
        if (labelPhotoUri === wine.labelPhotoUri) return wine;
        labelsChanged = true;
        return { ...wine, labelPhotoUri };
      });
      if (labelsChanged) {
        changed = true;
        next = { ...next, wineLabels };
        if (next.wineLabel && wineLabels[0]) {
          next = { ...next, wineLabel: wineLabels[0] };
        }
      }
    }

    const labels = wineLabelsForReview(next);
    const gallery = stripWineLabelUrisFromPhotoUrls(next.photoUrls ?? [], labels);
    if (
      gallery.length !== (next.photoUrls ?? []).length ||
      gallery.some((uri, i) => uri !== next.photoUrls[i])
    ) {
      changed = true;
      next = { ...next, photoUrls: gallery };
    }

    return next;
  });

  return { restaurants, reviews, changed };
}

async function readBase64FromUri(uri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) return null;
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

/**
 * Resolve a local review photo reference to a readable file URI.
 * Skips remote mock URLs. Falls back to the current sandbox Photos/ path when
 * an absolute URI from an older install no longer exists.
 */
export async function resolveLocalPhotoUri(
  pathOrUri: string,
): Promise<string | null> {
  const trimmed = pathOrUri.trim();
  if (!trimmed || isRemotePhotoUrl(trimmed)) return null;

  const relocated = relocateLocalPhotoRef(trimmed);
  const candidates: string[] = [];
  if (trimmed.startsWith('file://') || trimmed.startsWith('/')) {
    candidates.push(trimmed);
    if (relocated !== trimmed) candidates.push(relocated);
  } else {
    candidates.push(relocated);
    const root = FileSystem.documentDirectory;
    if (root) candidates.push(`${root}${trimmed}`);
  }

  const seen = new Set<string>();
  for (const uri of candidates) {
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && !info.isDirectory) return uri;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Drop review gallery refs that no longer point to a readable file.
 * Remote http(s) URLs (demo/showcase mock photos) are always kept — only
 * local refs whose file is missing from disk are considered broken.
 */
export async function filterExistingLocalPhotos(
  photoUrls: string[],
): Promise<{ photoUrls: string[]; removed: string[] }> {
  const kept: string[] = [];
  const removed: string[] = [];
  for (const raw of photoUrls) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    if (isRemotePhotoUrl(trimmed)) {
      kept.push(trimmed);
      continue;
    }
    const resolved = await resolveLocalPhotoUri(trimmed);
    if (resolved) {
      kept.push(resolved);
    } else {
      removed.push(trimmed);
    }
  }
  return { photoUrls: kept, removed };
}

/**
 * Collect local review / reviewer photo bytes for a `.gustra` package
 * (Swift `BackupService.exportEncryptedBackup` photo loop).
 * Remote http(s) mock URLs are ignored.
 */
export async function collectLocalPhotoFiles(
  pathOrUris: Iterable<string>,
): Promise<Record<string, string>> {
  const photoFiles: Record<string, string> = {};

  for (const raw of pathOrUris) {
    if (!raw || isRemotePhotoUrl(raw)) continue;
    const key = backupPhotoKey(raw);
    if (!key || key === REVIEWER_PHOTO_BACKUP_KEY) continue;
    if (photoFiles[key]) continue;

    const uri = await resolveLocalPhotoUri(raw);
    if (!uri) continue;
    const base64 = await readBase64FromUri(uri);
    if (base64) photoFiles[key] = base64;
  }

  return photoFiles;
}

/**
 * Write restored photo blobs into the Photos directory
 * (Swift `BackupService.writePhotos`).
 * Skips the Expo profile key (`reviewer.jpg`), which lives under Profile/.
 */
export async function writeBackupPhotos(
  photoFiles: Record<string, string> | null | undefined,
): Promise<void> {
  if (!photoFiles) return;
  const dir = await ensurePhotosDirectory();

  for (const [name, base64] of Object.entries(photoFiles)) {
    const key = name.trim();
    if (!key || !base64 || key === REVIEWER_PHOTO_BACKUP_KEY) continue;
    // Reject path traversal — keys must be plain filenames.
    if (key.includes('/') || key.includes('..')) continue;
    const uri = `${dir}${key}`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}
