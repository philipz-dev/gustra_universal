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
  getGoogleApiUsageSnapshot,
  hydrateGoogleApiTracker,
  resetGoogleApiCounters,
  subscribeGoogleApiTracker,
  type GoogleApiUsageSnapshot,
} from '@/services/google/GoogleApiTracker';

type GoogleApiTrackerValue = GoogleApiUsageSnapshot & {
  ready: boolean;
  resetAll: () => Promise<void>;
};

const GoogleApiTrackerContext = createContext<GoogleApiTrackerValue | null>(
  null,
);

export function GoogleApiTrackerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [usage, setUsage] = useState(getGoogleApiUsageSnapshot);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateGoogleApiTracker();
      if (!cancelled) {
        setUsage(getGoogleApiUsageSnapshot());
        setReady(true);
      }
    })();
    const unsubscribe = subscribeGoogleApiTracker((next) => {
      setUsage(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const resetAll = useCallback(async () => {
    await resetGoogleApiCounters();
  }, []);

  const value = useMemo(
    () => ({
      ...usage,
      ready,
      resetAll,
    }),
    [usage, ready, resetAll],
  );

  return (
    <GoogleApiTrackerContext.Provider value={value}>
      {children}
    </GoogleApiTrackerContext.Provider>
  );
}

export function useGoogleApiTracker(): GoogleApiTrackerValue {
  const ctx = useContext(GoogleApiTrackerContext);
  if (!ctx) {
    throw new Error(
      'useGoogleApiTracker must be used within GoogleApiTrackerProvider',
    );
  }
  return ctx;
}
