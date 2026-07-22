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
  getPhotoDataSavingsEnabled,
  hydratePhotoDataSavings,
  setPhotoDataSavingsEnabled,
  subscribePhotoDataSavings,
} from '@/services/photos/PhotoQualitySettings';

type PhotoQualitySettingsValue = {
  ready: boolean;
  /** Swift `isDataSavingsEnabled` — ON = lower resolution. */
  isDataSavingsEnabled: boolean;
  setDataSavingsEnabled: (enabled: boolean) => void;
};

const PhotoQualitySettingsContext =
  createContext<PhotoQualitySettingsValue | null>(null);

export function PhotoQualitySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [isDataSavingsEnabled, setIsDataSavingsEnabled] = useState(
    getPhotoDataSavingsEnabled,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydratePhotoDataSavings();
      if (!cancelled) {
        setIsDataSavingsEnabled(getPhotoDataSavingsEnabled());
        setReady(true);
      }
    })();
    const unsubscribe = subscribePhotoDataSavings((enabled) => {
      setIsDataSavingsEnabled(enabled);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setDataSavingsEnabled = useCallback((enabled: boolean) => {
    setIsDataSavingsEnabled(enabled);
    void setPhotoDataSavingsEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      isDataSavingsEnabled,
      setDataSavingsEnabled,
    }),
    [ready, isDataSavingsEnabled, setDataSavingsEnabled],
  );

  return (
    <PhotoQualitySettingsContext.Provider value={value}>
      {children}
    </PhotoQualitySettingsContext.Provider>
  );
}

export function usePhotoQualitySettings(): PhotoQualitySettingsValue {
  const ctx = useContext(PhotoQualitySettingsContext);
  if (!ctx) {
    throw new Error(
      'usePhotoQualitySettings must be used within PhotoQualitySettingsProvider',
    );
  }
  return ctx;
}
