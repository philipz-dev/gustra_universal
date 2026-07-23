import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import { SHARE_FILE_EXTENSION } from '@/services/share/types';
import { ShareInbox } from '@/services/share/ShareInbox';
import { uriLooksLikeSharePackage } from '@/services/share/ShareImportService';

export type ExpoShareHandoffFile = {
  uri: string;
  filename: string | null;
};

function hasShareExtension(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.endsWith(`.${SHARE_FILE_EXTENSION}`) || lower.endsWith('.json')
  );
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
    const withUri = resolved.filter(
      (payload) =>
        typeof payload.contentUri === 'string' &&
        payload.contentUri.length > 0,
    );

    let match = withUri.find(
      (payload) =>
        ShareInbox.isSharePackageURL(payload.contentUri!) ||
        hasShareExtension(payload.originalName),
    );

    if (!match) {
      for (const payload of withUri) {
        if (await uriLooksLikeSharePackage(payload.contentUri!)) {
          match = payload;
          break;
        }
      }
    }

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
