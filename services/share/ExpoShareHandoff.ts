import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import { SHARE_FILE_EXTENSION } from '@/services/share/types';
import { ShareInbox } from '@/services/share/ShareInbox';

export type ExpoShareHandoffFile = {
  uri: string;
  filename: string | null;
};

function isGustraShareFile(uri: string, originalName: string | null): boolean {
  if (ShareInbox.isSharePackageURL(uri)) return true;
  if (originalName?.toLowerCase().endsWith(`.${SHARE_FILE_EXTENSION}`)) {
    return true;
  }
  return false;
}

/**
 * Read a staged `.gustrashare` from the iOS Share Extension App Group
 * (`expo-sharing`), then clear the shared payloads.
 *
 * Returns null when nothing is pending or the platform/module is unavailable
 * (Expo Go / Android without share-into).
 */
export async function consumeExpoShareHandoffFile(): Promise<ExpoShareHandoffFile | null> {
  if (Platform.OS !== 'ios') return null;
  if (typeof Sharing.getSharedPayloads !== 'function') return null;

  let rawCount = 0;
  try {
    rawCount = Sharing.getSharedPayloads()?.length ?? 0;
  } catch {
    // App Group id missing (e.g. Expo Go / plugin not applied).
    return null;
  }
  if (rawCount === 0) return null;

  try {
    const resolved = await Sharing.getResolvedSharedPayloadsAsync();
    const match = resolved.find(
      (payload) =>
        typeof payload.contentUri === 'string' &&
        payload.contentUri.length > 0 &&
        isGustraShareFile(payload.contentUri, payload.originalName ?? null),
    );

    Sharing.clearSharedPayloads();

    if (!match?.contentUri) {
      throw new Error('This is not a Gustra share file.');
    }

    return {
      uri: match.contentUri,
      filename: match.originalName ?? null,
    };
  } catch (error) {
    try {
      Sharing.clearSharedPayloads();
    } catch {
      // ignore
    }
    throw error;
  }
}

/** True when the deep link came from the expo-sharing Share Extension. */
export function isExpoSharingHandoffURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === 'expo-sharing';
  } catch {
    return false;
  }
}
