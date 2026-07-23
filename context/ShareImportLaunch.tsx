import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';

import type { ReviewOrigin } from '@/data/types';
import type { SharePackage } from '@/services/share/ReviewShareService';
import {
  consumeExpoShareHandoffFile,
  isExpoSharingHandoffURL,
} from '@/services/share/ExpoShareHandoff';
import { ShareInbox } from '@/services/share/ShareInbox';
import {
  loadSharePackage,
  ShareImportError,
} from '@/services/share/ShareImportService';

type ShareImportLaunchValue = {
  /** Present the system document picker for a `.gustrashare` file. */
  pickSharePackage: () => Promise<void>;
  /** Load a package from a local/content URI and open the selection screen. */
  openSharePackageUri: (uri: string, filename?: string | null) => Promise<void>;
};

const ShareImportLaunchContext =
  createContext<ShareImportLaunchValue | null>(null);

const pendingPackageHolder: { current: SharePackage | null } = {
  current: null,
};

/** After a successful import, feed should select Friends' reviews. */
const pendingFeedReviewSourceHolder: { current: ReviewOrigin | null } = {
  current: null,
};

/** Read the package handed off for the selection screen. */
export function takePendingSharePackage(): SharePackage | null {
  return pendingPackageHolder.current;
}

export function clearPendingSharePackage(): void {
  pendingPackageHolder.current = null;
}

/** Ask the Reviews feed to select this source on next focus (post-import). */
export function requestFeedReviewSource(source: ReviewOrigin): void {
  pendingFeedReviewSourceHolder.current = source;
}

/** Consume a one-shot feed source request (or null). */
export function consumePendingFeedReviewSource(): ReviewOrigin | null {
  const next = pendingFeedReviewSourceHolder.current;
  pendingFeedReviewSourceHolder.current = null;
  return next;
}

export function ShareImportLaunchProvider({
  children,
}: {
  children: ReactNode;
}) {
  const handlingRef = useRef(false);

  const openLoadedPackage = useCallback((packageData: SharePackage) => {
    pendingPackageHolder.current = packageData;
    router.push('/share-import');
  }, []);

  const openSharePackageUri = useCallback(
    async (uri: string, filename?: string | null) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      let stagedUri: string | null = null;
      try {
        stagedUri = await ShareInbox.stageShareFile(uri, filename);
        const packageData = await loadSharePackage(stagedUri);
        openLoadedPackage(packageData);
      } catch (error) {
        const message =
          error instanceof ShareImportError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not read the shared reviews file.';
        houseAlert('Error', message);
      } finally {
        if (stagedUri) {
          await FileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(
            () => undefined,
          );
          await AsyncStorageClearPending();
        }
        handlingRef.current = false;
      }
    },
    [openLoadedPackage],
  );

  /** iOS Share Extension → App Group payloads (`expo-sharing`). */
  const consumeExpoShareHandoffIfNeeded = useCallback(async () => {
    if (handlingRef.current) return;
    try {
      const handoff = await consumeExpoShareHandoffFile();
      if (!handoff) return;
      await openSharePackageUri(handoff.uri, handoff.filename);
    } catch (error) {
      houseAlert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not read the shared reviews file.',
      );
    }
  }, [openSharePackageUri]);

  const consumePendingIfNeeded = useCallback(async () => {
    if (handlingRef.current) return;
    // Prefer App Group handoff from the Share Extension when present.
    await consumeExpoShareHandoffIfNeeded();
    if (handlingRef.current) return;
    try {
      const pending = await ShareInbox.consumePendingShareFile();
      if (!pending) return;
      handlingRef.current = true;
      try {
        const packageData = await loadSharePackage(pending);
        openLoadedPackage(packageData);
      } finally {
        await FileSystem.deleteAsync(pending, { idempotent: true }).catch(
          () => undefined,
        );
        handlingRef.current = false;
      }
    } catch (error) {
      handlingRef.current = false;
      houseAlert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not read the shared reviews file.',
      );
    }
  }, [consumeExpoShareHandoffIfNeeded, openLoadedPackage]);

  const handleIncomingURL = useCallback(
    async (url: string | null) => {
      if (!url) return;
      if (isExpoSharingHandoffURL(url) || ShareInbox.isShareImportURL(url)) {
        await consumePendingIfNeeded();
        return;
      }
      if (ShareInbox.isSharePackageURL(url)) {
        await openSharePackageUri(url);
      }
    },
    [consumePendingIfNeeded, openSharePackageUri],
  );

  const pickSharePackage = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/x-gustrashare',
          'application/json',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Don't reject on filename alone — WhatsApp rewrites to `.json`.
      // loadSharePackage sniffs content and shows a clear error if invalid.
      await openSharePackageUri(asset.uri, asset.name || null);
    } catch (error) {
      houseAlert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not open the shared reviews file.',
      );
    }
  }, [openSharePackageUri]);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      void handleIncomingURL(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingURL(url);
    });
    return () => sub.remove();
  }, [handleIncomingURL]);

  useEffect(() => {
    void consumePendingIfNeeded();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void consumePendingIfNeeded();
    });
    return () => sub.remove();
  }, [consumePendingIfNeeded]);

  const value = useMemo(
    () => ({
      pickSharePackage,
      openSharePackageUri,
    }),
    [pickSharePackage, openSharePackageUri],
  );

  return (
    <ShareImportLaunchContext.Provider value={value}>
      {children}
    </ShareImportLaunchContext.Provider>
  );
}

async function AsyncStorageClearPending() {
  const AsyncStorage = (
    await import('@react-native-async-storage/async-storage')
  ).default;
  await AsyncStorage.setItem('gustra.share.pendingShareImport', 'false');
  await AsyncStorage.removeItem('gustra.share.pendingShareFilename');
}

export function useShareImportLaunch(): ShareImportLaunchValue {
  const ctx = useContext(ShareImportLaunchContext);
  if (!ctx) {
    throw new Error(
      'useShareImportLaunch must be used within ShareImportLaunchProvider',
    );
  }
  return ctx;
}
