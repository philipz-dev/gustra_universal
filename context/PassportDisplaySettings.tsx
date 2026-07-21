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

export type CategoryAveragesDisplayStyle = 'numbers' | 'stars';

const STORAGE_KEY = 'passportCategoryAveragesDisplayStyle';

type PassportDisplaySettingsValue = {
  categoryAveragesStyle: CategoryAveragesDisplayStyle;
  /** Label for the currently active style (Swift `categoryAveragesToggleTitle`). */
  categoryAveragesToggleTitle: string;
  toggleCategoryAveragesStyle: () => void;
  ready: boolean;
};

const PassportDisplaySettingsContext =
  createContext<PassportDisplaySettingsValue | null>(null);

function toggleTitle(style: CategoryAveragesDisplayStyle): string {
  return style === 'numbers'
    ? 'Show ratings as numbers'
    : 'Show ratings as stars';
}

export function PassportDisplaySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Swift default when unset: numbers
  const [categoryAveragesStyle, setCategoryAveragesStyle] =
    useState<CategoryAveragesDisplayStyle>('numbers');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (
          !cancelled &&
          (raw === 'numbers' || raw === 'stars')
        ) {
          setCategoryAveragesStyle(raw);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCategoryAveragesStyle = useCallback(() => {
    setCategoryAveragesStyle((current) => {
      const next: CategoryAveragesDisplayStyle =
        current === 'numbers' ? 'stars' : 'numbers';
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      categoryAveragesStyle,
      categoryAveragesToggleTitle: toggleTitle(categoryAveragesStyle),
      toggleCategoryAveragesStyle,
      ready,
    }),
    [categoryAveragesStyle, toggleCategoryAveragesStyle, ready],
  );

  return (
    <PassportDisplaySettingsContext.Provider value={value}>
      {children}
    </PassportDisplaySettingsContext.Provider>
  );
}

export function usePassportDisplaySettings(): PassportDisplaySettingsValue {
  const ctx = useContext(PassportDisplaySettingsContext);
  if (!ctx) {
    throw new Error(
      'usePassportDisplaySettings must be used within PassportDisplaySettingsProvider',
    );
  }
  return ctx;
}
