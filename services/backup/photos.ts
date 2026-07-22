import * as FileSystem from 'expo-file-system/legacy';

import { REVIEWER_PHOTO_BACKUP_KEY } from '@/services/backup/types';

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
 * Skips remote mock URLs.
 */
export async function resolveLocalPhotoUri(
  pathOrUri: string,
): Promise<string | null> {
  const trimmed = pathOrUri.trim();
  if (!trimmed || isRemotePhotoUrl(trimmed)) return null;

  const candidates: string[] = [];
  if (trimmed.startsWith('file://') || trimmed.startsWith('/')) {
    candidates.push(trimmed);
  } else {
    candidates.push(localPhotoUri(trimmed));
    const root = FileSystem.documentDirectory;
    if (root) candidates.push(`${root}${trimmed}`);
  }

  for (const uri of candidates) {
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
