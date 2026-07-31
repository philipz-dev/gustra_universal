import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  SHARE_FILE_EXTENSION,
  SHARE_UTI,
} from '@/services/share/types';

const PENDING_KEY = 'gustra.share.pendingShareImport';
const FILENAME_KEY = 'gustra.share.pendingShareFilename';

/**
 * Stage a share package into Documents/ShareInbox.
 *
 * - `content://` (WhatsApp, Downloads, …): only `copyAsync` supports the scheme;
 *   `readAsStringAsync` throws "Unsupported scheme".
 * - Android DocumentPicker `file://` cache URIs often reject `copyAsync`
 *   ("isn't readable") — prefer UTF-8 / Base64 read-write there.
 * - Other local paths: `copyAsync` first, then read/write fallback.
 */
async function copySharePackageToInbox(
  sourceUri: string,
  destination: string,
): Promise<void> {
  const trimmed = sourceUri.trim();
  const isContentUri = /^content:\/\//i.test(trimmed);

  if (isContentUri) {
    await FileSystem.copyAsync({ from: trimmed, to: destination });
    return;
  }

  const preferReadWrite =
    Platform.OS === 'android' || /DocumentPicker/i.test(trimmed);

  if (!preferReadWrite) {
    try {
      await FileSystem.copyAsync({ from: trimmed, to: destination });
      return;
    } catch {
      // Fall through — rare iOS path quirks.
    }
  }

  try {
    const raw = await FileSystem.readAsStringAsync(trimmed, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await FileSystem.writeAsStringAsync(destination, raw, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // Last resort: binary-safe path for odd encodings / SAF quirks.
    const raw = await FileSystem.readAsStringAsync(trimmed, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(destination, raw, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

/**
 * Local share-file staging for picker / document open (Documents/ShareInbox/).
 * iOS Share Extension → App Group handoff is handled by `expo-sharing`
 * (`services/share/ExpoShareHandoff.ts`).
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

  /**
   * Android VIEW intents often hand a `content://…` URI with no filename /
   * extension. Those still open our app via the share intent-filters.
   */
  isExternalShareDocumentURL(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('content:')) return true;
    if (lower.startsWith('file:')) {
      // Ignore our own staged inbox / app files.
      if (lower.includes('/shareinbox/')) return false;
      return (
        this.isSharePackageURL(trimmed) ||
        lower.includes(`.${this.fileExtension}`) ||
        /\.json(\?|#|$)/i.test(trimmed)
      );
    }
    return false;
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
   *
   * Android `content://` (WhatsApp) uses `copyAsync`; DocumentPicker
   * `file://` cache URIs fall back to UTF-8 / Base64 read-write.
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
    // WhatsApp / Mail often rewrite our package as `.json` or strip the
    // extension — normalize to `.gustrashare`; content is validated on load.
    if (!filename.toLowerCase().endsWith(`.${this.fileExtension}`)) {
      const base =
        filename.replace(/\.[^/.]+$/, '').trim() ||
        (this.isSharePackageURL(sourceUri)
          ? decodeURIComponent(
              sourceUri.split('/').filter(Boolean).pop() ?? '',
            ).replace(/\.[^/.]+$/, '')
          : '') ||
        'share';
      filename = `${base}.${this.fileExtension}`;
    }

    const inbox = await this.ensureInbox();
    await this.clearInbox();
    const destination = `${inbox}${filename}`;
    await copySharePackageToInbox(sourceUri, destination);
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
