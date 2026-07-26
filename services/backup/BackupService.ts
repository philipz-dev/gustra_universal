import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { Restaurant, Review } from '@/data/types';
import {
  base64ToBytes,
  bytesToBase64,
  decryptBackupJson,
  encryptBackupJson,
} from '@/services/backup/crypto';
import {
  backupRestaurantToApp,
  backupReviewToApp,
  buildPayloadFromApp,
} from '@/services/backup/mapping';
import {
  collectLocalPhotoFiles,
  writeBackupPhotos,
} from '@/services/backup/photos';
import {
  BACKUP_FILE_EXTENSION,
  BACKUP_SCHEMA_VERSION,
  REVIEWER_PHOTO_BACKUP_KEY,
  type BackupImportMode,
  type BackupPayload,
  type CriteriaSettingsBackup,
  type LocalBackupFile,
  type ReviewerProfileBackup,
} from '@/services/backup/types';

/** Gather local photo refs from reviews (skips remote mock URLs). */
function localPhotoRefsFromReviews(reviews: Review[]): string[] {
  const refs: string[] = [];
  for (const review of reviews) {
    for (const url of review.photoUrls) refs.push(url);
    const label = review.wineLabel?.labelPhotoUri?.trim();
    if (label) refs.push(label);
  }
  return refs;
}

function backupsDirectory(): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Document directory unavailable');
  return `${root}Backups/`;
}

async function ensureBackupsDir() {
  const dir = backupsDirectory();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export function makeBackupFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const name = `Backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${name}.${BACKUP_FILE_EXTENSION}`;
}

/** AutoProtect JSON snapshots expire after this many days (user `.gustra` backups are kept). */
export const AUTO_PROTECT_RETENTION_DAYS = 30;

const AUTO_PROTECT_PREFIX = 'AutoProtect-';

/**
 * Delete AutoProtect-*.json snapshots older than {@link AUTO_PROTECT_RETENTION_DAYS}.
 * Never touches encrypted `.gustra` backups or Swift source files.
 * Always keeps the newest AutoProtect file if present.
 */
export async function pruneAutoProtectBackups(
  retentionDays: number = AUTO_PROTECT_RETENTION_DAYS,
): Promise<number> {
  const dir = await ensureBackupsDir();
  const names = await FileSystem.readDirectoryAsync(dir);
  const cutoffMs = Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
  const protect: { uri: string; modified: number }[] = [];

  for (const name of names) {
    if (!name.startsWith(AUTO_PROTECT_PREFIX)) continue;
    if (!name.toLowerCase().endsWith('.json')) continue;
    const uri = `${dir}${name}`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || info.isDirectory) continue;
      protect.push({
        uri,
        modified: info.modificationTime ? info.modificationTime * 1000 : 0,
      });
    } catch {
      // skip
    }
  }

  if (protect.length === 0) return 0;
  protect.sort((a, b) => b.modified - a.modified);
  const newestUri = protect[0]?.uri;
  let deleted = 0;
  for (const file of protect) {
    if (file.uri === newestUri) continue;
    if (file.modified > 0 && file.modified >= cutoffMs) continue;
    try {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      deleted += 1;
    } catch {
      // ignore
    }
  }
  return deleted;
}

export async function listLocalBackups(): Promise<LocalBackupFile[]> {
  const dir = await ensureBackupsDir();
  const names = await FileSystem.readDirectoryAsync(dir);
  const files: LocalBackupFile[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith(`.${BACKUP_FILE_EXTENSION}`)) continue;
    const uri = `${dir}${name}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) continue;
    files.push({
      uri,
      name,
      modified: info.modificationTime ? info.modificationTime * 1000 : 0,
      byteCount: info.size ?? 0,
    });
  }
  return files.sort((a, b) => b.modified - a.modified);
}

export async function saveLocalBackup(
  bytes: Uint8Array,
  filename?: string,
): Promise<{ uri: string; filename: string }> {
  const dir = await ensureBackupsDir();
  const name = filename ?? makeBackupFilename();
  const uri = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri, filename: name };
}

export async function deleteLocalBackup(uri: string): Promise<void> {
  const root = (await ensureBackupsDir()).replace(/\/?$/, '/');
  const normalized = uri.startsWith('file://') ? uri : uri;
  if (!normalized.startsWith(root) && !normalized.includes('/Backups/')) {
    throw new Error('Could not delete the backup file.');
  }
  await FileSystem.deleteAsync(normalized, { idempotent: true });
}

export async function readBackupFile(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

/**
 * Build + encrypt a Swift-compatible `.gustra` backup.
 * Collects local review photos into `photoFiles` (remote mock URLs skipped).
 */
export async function exportEncryptedBackup(args: {
  restaurants: Restaurant[];
  reviews: Review[];
  password: string;
  /** Extra files (e.g. profile `reviewer.jpg`) merged on top of review photos. */
  photoFiles?: Record<string, string>;
  reviewerProfile?: ReviewerProfileBackup | null;
  criteriaSettings?: CriteriaSettingsBackup | null;
}): Promise<Uint8Array> {
  if (!args.password) throw new Error('Could not encrypt the backup file.');
  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const reviewPhotos = await collectLocalPhotoFiles(
    localPhotoRefsFromReviews(args.reviews),
  );
  const photoFiles = {
    ...reviewPhotos,
    ...(args.photoFiles ?? {}),
  };

  const payload = buildPayloadFromApp({
    restaurants: args.restaurants,
    reviews: args.reviews,
    appVersion,
    photoFiles,
    reviewerProfile: args.reviewerProfile,
    criteriaSettings: args.criteriaSettings,
  });
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Could not encrypt the backup file.');
  }
  try {
    return encryptBackupJson(JSON.stringify(payload), args.password);
  } catch {
    throw new Error('Could not encrypt the backup file.');
  }
}

export function reviewerProfileFromPayload(
  payload: BackupPayload,
): { profile: ReviewerProfileBackup; photoBase64: string | null } | null {
  if (!payload.reviewerProfile) return null;
  const key =
    payload.reviewerProfile.photoFileName?.trim() || REVIEWER_PHOTO_BACKUP_KEY;
  const photoBase64 =
    payload.reviewerProfile.photoFileName && payload.photoFiles?.[key]
      ? payload.photoFiles[key]!
      : null;
  return { profile: payload.reviewerProfile, photoBase64 };
}

export function criteriaSettingsFromPayload(
  payload: BackupPayload,
): CriteriaSettingsBackup | null {
  return payload.criteriaSettings ?? null;
}

export function decryptBackup(
  data: Uint8Array,
  password: string,
): BackupPayload {
  const json = decryptBackupJson(data, password);
  let payload: BackupPayload;
  try {
    payload = JSON.parse(json) as BackupPayload;
  } catch {
    throw new Error('Incorrect backup password.');
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.reviews)) {
    throw new Error('Incorrect backup password.');
  }
  return payload;
}

/**
 * Apply decrypted payload to app models after photos are written to disk
 * (Swift merge / overwrite + `writePhotos`).
 */
export async function applyBackupPayload(args: {
  payload: BackupPayload;
  mode: BackupImportMode;
  currentRestaurants: Restaurant[];
  currentReviews: Review[];
}): Promise<{ restaurants: Restaurant[]; reviews: Review[] }> {
  const { payload, mode } = args;

  await writeBackupPhotos(payload.photoFiles);

  if (mode === 'overwrite') {
    const restaurants = payload.restaurants.map((r) =>
      backupRestaurantToApp(r),
    );
    const reviews = payload.reviews.map((r) => backupReviewToApp(r));
    // Prefer restaurant photo from first review photo if empty.
    for (const restaurant of restaurants) {
      if (!restaurant.photoUrl) {
        const first = reviews.find((r) => r.restaurantId === restaurant.id);
        restaurant.photoUrl = first?.photoUrls[0] ?? '';
      }
    }
    return { restaurants, reviews };
  }

  const restaurantsById = new Map(
    args.currentRestaurants.map((r) => [r.id, r]),
  );
  const reviewsById = new Map(args.currentReviews.map((r) => [r.id, r]));

  for (const item of payload.restaurants) {
    const prev = restaurantsById.get(item.id);
    restaurantsById.set(item.id, backupRestaurantToApp(item, prev));
  }
  for (const item of payload.reviews) {
    const prev = reviewsById.get(item.id);
    reviewsById.set(item.id, backupReviewToApp(item, prev));
  }

  return {
    restaurants: [...restaurantsById.values()],
    reviews: [...reviewsById.values()],
  };
}

export async function shareBackupFile(
  bytes: Uint8Array,
  filename?: string,
): Promise<string> {
  const name = filename ?? makeBackupFilename();
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) throw new Error('Could not encrypt the backup file.');
  const uri = `${cacheRoot}${name}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Share Gustra backup',
    UTI: 'public.data',
  });
  return name;
}

export function formatByteCount(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
