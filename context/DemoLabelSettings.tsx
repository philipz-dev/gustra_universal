import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'showDemoLabelOnDemoReviews';

/** Survives provider remounts / Fast Refresh so the choice is not lost. */
let cached = true;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

async function hydrate(): Promise<boolean> {
  if (hydrated) return cached;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw === '0' || raw === 'false') cached = false;
      else if (raw === '1' || raw === 'true') cached = true;
    } catch {
      // keep cached default
    } finally {
      hydrated = true;
      hydratePromise = null;
    }
    return cached;
  })();
  return hydratePromise;
}

async function persist(next: boolean): Promise<void> {
  cached = next;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Preference still held in memory for this session.
  }
}

type DemoLabelSettingsValue = {
  showDemoLabel: boolean;
  setShowDemoLabel: (next: boolean) => void;
  ready: boolean;
};

const DemoLabelSettingsContext =
  createContext<DemoLabelSettingsValue | null>(null);

export function DemoLabelSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [showDemoLabel, setShowDemoLabelState] = useState(cached);
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value = await hydrate();
      if (cancelled) return;
      setShowDemoLabelState(value);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setShowDemoLabel = useCallback((next: boolean) => {
    setShowDemoLabelState(next);
    void persist(next);
  }, []);

  const value = useMemo(
    () => ({ showDemoLabel, setShowDemoLabel, ready }),
    [showDemoLabel, setShowDemoLabel, ready],
  );

  return (
    <DemoLabelSettingsContext.Provider value={value}>
      {children}
    </DemoLabelSettingsContext.Provider>
  );
}

export function useDemoLabelSettings(): DemoLabelSettingsValue {
  const ctx = useContext(DemoLabelSettingsContext);
  if (!ctx) {
    throw new Error(
      'useDemoLabelSettings must be used within DemoLabelSettingsProvider',
    );
  }
  return ctx;
}
