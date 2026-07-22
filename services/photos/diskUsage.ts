import * as FileSystem from 'expo-file-system/legacy';

import { formatByteCount } from '@/services/backup/BackupService';

export type PhotosDiskUsage = {
  byteCount: number;
  fileCount: number;
  /** e.g. `24.6 MB` */
  formattedBytes: string;
  /** e.g. `12 photos stored locally` */
  subtitle: string;
};

function photosDir(): string | null {
  const root = FileSystem.documentDirectory;
  return root ? `${root}Photos/` : null;
}

function profileDir(): string | null {
  const root = FileSystem.documentDirectory;
  return root ? `${root}Profile/` : null;
}

async function directoryMediaUsage(
  directory: string | null,
): Promise<{ byteCount: number; fileCount: number }> {
  if (!directory) return { byteCount: 0, fileCount: 0 };
  try {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) return { byteCount: 0, fileCount: 0 };
    const names = await FileSystem.readDirectoryAsync(directory);
    let byteCount = 0;
    let fileCount = 0;
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const path = `${directory}${name}`;
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (!fileInfo.exists || fileInfo.isDirectory) continue;
      const size =
        'size' in fileInfo && typeof fileInfo.size === 'number'
          ? fileInfo.size
          : 0;
      byteCount += size;
      fileCount += 1;
    }
    return { byteCount, fileCount };
  } catch {
    return { byteCount: 0, fileCount: 0 };
  }
}

/**
 * Total size of locally persisted media (review photos + profile)
 * — Swift `ImageCompressionService.photosDiskUsage`.
 */
export async function getPhotosDiskUsage(): Promise<PhotosDiskUsage> {
  const [photos, profile] = await Promise.all([
    directoryMediaUsage(photosDir()),
    directoryMediaUsage(profileDir()),
  ]);
  const byteCount = photos.byteCount + profile.byteCount;
  const fileCount = photos.fileCount + profile.fileCount;
  const photoWord = fileCount === 1 ? 'photo' : 'photos';
  return {
    byteCount,
    fileCount,
    formattedBytes: formatByteCount(byteCount),
    subtitle: `${fileCount} ${photoWord} stored locally`,
  };
}
