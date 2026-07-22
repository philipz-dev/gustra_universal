import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import {
  hydratePhotoDataSavings,
  reviewPhotoMaxPixelSide,
} from '@/services/photos/PhotoQualitySettings';

function photosDir(): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Document directory unavailable');
  return `${root}Photos/`;
}

async function ensurePhotosDir(): Promise<string> {
  const dir = photosDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Compress and copy a picked image into the app Photos folder.
 * Max side follows data-savings setting (Swift `reviewPhotoStorageScale`).
 * Returns a stable `file://` URI.
 */
export async function saveReviewPhoto(sourceUri: string): Promise<string> {
  await hydratePhotoDataSavings();
  const maxSide = reviewPhotoMaxPixelSide();
  const prepared = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: maxSide } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  const dir = await ensurePhotosDir();
  const filename = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const dest = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: prepared.uri, to: dest });
  return dest;
}

export async function deleteReviewPhotoFiles(uris: string[]): Promise<void> {
  await Promise.all(
    uris.map(async (uri) => {
      if (!uri.startsWith('file://')) return;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // ignore missing files
      }
    }),
  );
}
