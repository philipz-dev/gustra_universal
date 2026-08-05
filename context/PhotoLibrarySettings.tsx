import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  hydratePhotoLibrarySave,
  isPhotoLibrarySaveEnabled as getPhotoLibrarySaveEnabled,
  setPhotoLibrarySaveEnabled,
  subscribePhotoLibrarySave,
} from '@/services/photos/PhotoLibrarySave';

type PhotoLibrarySettingsValue = {
  ready: boolean;
  /** Default ON — review photos are also written to the system photo library. */
  isPhotoLibrarySaveEnabled: boolean;
  setPhotoLibrarySaveEnabled: (enabled: boolean) => void;
};

const PhotoLibrarySettingsContext =
  createContext<PhotoLibrarySettingsValue | null>(null);

export function PhotoLibrarySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [isPhotoLibrarySaveEnabled, setIsPhotoLibrarySaveEnabled] = useState(
    getPhotoLibrarySaveEnabled,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydratePhotoLibrarySave();
      if (!cancelled) {
        setIsPhotoLibrarySaveEnabled(getPhotoLibrarySaveEnabled());
        setReady(true);
      }
    })();
    const unsubscribe = subscribePhotoLibrarySave((enabled) => {
      setIsPhotoLibrarySaveEnabled(enabled);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setPhotoLibrarySaveEnabledState = useCallback((enabled: boolean) => {
    setIsPhotoLibrarySaveEnabled(enabled);
    void setPhotoLibrarySaveEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      isPhotoLibrarySaveEnabled,
      setPhotoLibrarySaveEnabled: setPhotoLibrarySaveEnabledState,
    }),
    [ready, isPhotoLibrarySaveEnabled, setPhotoLibrarySaveEnabledState],
  );

  return (
    <PhotoLibrarySettingsContext.Provider value={value}>
      {children}
    </PhotoLibrarySettingsContext.Provider>
  );
}

export function usePhotoLibrarySettings(): PhotoLibrarySettingsValue {
  const ctx = useContext(PhotoLibrarySettingsContext);
  if (!ctx) {
    throw new Error(
      'usePhotoLibrarySettings must be used within PhotoLibrarySettingsProvider',
    );
  }
  return ctx;
}
