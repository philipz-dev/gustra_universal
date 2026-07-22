import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  SHARE_FILE_EXTENSION,
  SHARE_UTI,
} from '@/services/share/types';

const PENDING_KEY = 'gustra.share.pendingShareImport';
const FILENAME_KEY = 'gustra.share.pendingShareFilename';

/**
 * Local share-file staging (Swift `ShareInbox` — App Group omitted on Expo;
 * files live under Documents/ShareInbox/).
 */
export const ShareInbox = {
  fileExtension: SHARE_FILE_EXTENSION,
  utiIdentifier: SHARE_UTI,
  urlScheme: 'gustra',
  importHost: 'import-share',

  get openAppURL(): string {
    return `${this.urlScheme}://${this.importHost}`;
  },

  inboxDirectory(): string {
    const root = FileSystem.documentDirectory;
    if (!root) throw new Error('Could not access the shared Gustra folder.');
    return `${root}ShareInbox/`;
  },

  isShareImportURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol.replace(':', '').toLowerCase() === this.urlScheme &&
        parsed.hostname.toLowerCase() === this.importHost
      );
    } catch {
      return false;
    }
  },

  isSharePackageURL(url: string): boolean {
    const clean = url.split('?')[0]?.split('#')[0] ?? url;
    return clean.toLowerCase().endsWith(`.${this.fileExtension}`);
  },

  async ensureInbox(): Promise<string> {
    const inbox = this.inboxDirectory();
    const info = await FileSystem.getInfoAsync(inbox);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(inbox, { intermediates: true });
    }
    return inbox;
  },

  async clearInbox(): Promise<void> {
    const inbox = await this.ensureInbox();
    const listing = await FileSystem.readDirectoryAsync(inbox);
    await Promise.all(
      listing.map((name) =>
        FileSystem.deleteAsync(`${inbox}${name}`, { idempotent: true }),
      ),
    );
  },

  /**
   * Copy a share package into the inbox and mark it pending
   * (Swift `ShareInbox.stageShareFile`).
   */
  async stageShareFile(
    sourceUri: string,
    filenameOverride?: string | null,
  ): Promise<string> {
    let filename = (filenameOverride ?? '').trim();
    if (!filename) {
      const parts = sourceUri.split('/').filter(Boolean);
      filename = decodeURIComponent(parts[parts.length - 1] ?? '');
    }
    if (!filename.toLowerCase().endsWith(`.${this.fileExtension}`)) {
      if (this.isSharePackageURL(sourceUri)) {
        const parts = sourceUri.split('/').filter(Boolean);
        filename = decodeURIComponent(parts[parts.length - 1] ?? '');
      } else {
        filename = `share.${this.fileExtension}`;
      }
    }
    if (!filename.toLowerCase().endsWith(`.${this.fileExtension}`)) {
      throw new Error('This is not a Gustra share file.');
    }

    const inbox = await this.ensureInbox();
    await this.clearInbox();
    const destination = `${inbox}${filename}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    await AsyncStorage.setItem(PENDING_KEY, 'true');
    await AsyncStorage.setItem(FILENAME_KEY, filename);
    return destination;
  },

  /** Return a staged file URI if pending, then clear the pending flag. */
  async consumePendingShareFile(): Promise<string | null> {
    const pending = await AsyncStorage.getItem(PENDING_KEY);
    if (pending !== 'true') return null;

    await AsyncStorage.setItem(PENDING_KEY, 'false');
    const filename = await AsyncStorage.getItem(FILENAME_KEY);
    await AsyncStorage.removeItem(FILENAME_KEY);

    try {
      const inbox = await this.ensureInbox();
      if (filename) {
        const uri = `${inbox}${filename}`;
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && !info.isDirectory) return uri;
      }
      const listing = await FileSystem.readDirectoryAsync(inbox);
      const match = listing.find((name) =>
        name.toLowerCase().endsWith(`.${this.fileExtension}`),
      );
      return match ? `${inbox}${match}` : null;
    } catch {
      return null;
    }
  },
};
