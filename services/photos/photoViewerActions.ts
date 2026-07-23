import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { isRemotePhotoUrl } from '@/services/backup/photos';

/** Resolve a local `file://` URI suitable for share / save. */
export async function ensureLocalPhotoUri(uri: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) throw new Error('No photo available.');

  if (trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/')) return `file://${trimmed}`;

  if (!isRemotePhotoUrl(trimmed)) {
    // Relative Photos/ key
    const root = FileSystem.documentDirectory;
    if (!root) throw new Error('Could not read photo.');
    const local = `${root}Photos/${trimmed.split('/').pop()}`;
    const info = await FileSystem.getInfoAsync(local);
    if (info.exists) return local.startsWith('file://') ? local : `file://${local}`;
  }

  const cache = FileSystem.cacheDirectory;
  if (!cache) throw new Error('Could not prepare photo.');
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    trimmed,
  );
  const dest = `${cache}photo-viewer-${hash.slice(0, 16)}.jpg`;
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) return dest;

  const downloaded = await FileSystem.downloadAsync(trimmed, dest);
  return downloaded.uri;
}

async function presentSystemShare(
  localUri: string,
  dialogTitle: string,
): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, {
      mimeType: 'image/jpeg',
      dialogTitle,
      UTI: 'public.jpeg',
    });
    return;
  }
  if (Platform.OS === 'ios') {
    await Share.share({ url: localUri });
    return;
  }
  throw new Error('Sharing is not available on this device.');
}

export async function sharePhotoUri(uri: string): Promise<void> {
  const local = await ensureLocalPhotoUri(uri);
  await presentSystemShare(local, 'Share photo');
}

/** Save a photo into the device library (Swift `Save to Photos`, add-only). */
export async function savePhotoUri(uri: string): Promise<void> {
  const local = await ensureLocalPhotoUri(uri);
  const { status } = await requestPermissionsAsync(true);
  if (status !== 'granted') {
    throw new Error('Photo access needed to save.');
  }
  await Asset.create(local);
}
