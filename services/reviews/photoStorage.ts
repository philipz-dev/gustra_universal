import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

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

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

/**
 * Compress and copy a picked image into the app Photos folder.
 * Longest side fits `maxPixelSide` (Swift `fittingMaxPixelSide`) — aspect preserved.
 * Returns a stable `file://` URI.
 */
export async function saveReviewPhoto(sourceUri: string): Promise<string> {
  await hydratePhotoDataSavings();
  const maxSide = reviewPhotoMaxPixelSide();

  let actions: ImageManipulator.Action[] = [];
  try {
    const { width, height } = await getImageSize(sourceUri);
    const longest = Math.max(width, height);
    if (longest > maxSide && longest > 0) {
      const scale = maxSide / longest;
      actions = [
        {
          resize: {
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
          },
        },
      ];
    }
  } catch {
    // Fallback: width-only resize still preserves aspect in ImageManipulator.
    actions = [{ resize: { width: maxSide } }];
  }

  const prepared = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const dir = await ensurePhotosDir();
  const filename = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const dest = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: prepared.uri, to: dest });
  return dest;
}

export async function deleteReviewPhotoFiles(uris: string[]): Promise<void> {
  await Promise.all(
    uris.map(async (raw) => {
      const trimmed = raw?.trim();
      if (!trimmed || /^https?:\/\//i.test(trimmed)) return;
      const candidates = [trimmed];
      if (!trimmed.startsWith('file://') && !trimmed.startsWith('/')) {
        try {
          candidates.push(`${photosDir()}${trimmed.split('/').pop()}`);
        } catch {
          // document directory unavailable
        }
      }
      for (const uri of candidates) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && !info.isDirectory) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
            break;
          }
        } catch {
          // try next candidate
        }
      }
    }),
  );
}
