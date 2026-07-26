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
import { useTranslation } from 'react-i18next';

import { i18n } from '@/i18n';

export type CategoryAveragesDisplayStyle = 'numbers' | 'stars';

const STORAGE_KEY = 'passportCategoryAveragesDisplayStyle';

/** Survives provider remounts / Fast Refresh so stars preference is not lost. */
let cachedStyle: CategoryAveragesDisplayStyle = 'stars';
let hydrated = false;
let hydratePromise: Promise<CategoryAveragesDisplayStyle> | null = null;

function isStyle(value: string | null): value is CategoryAveragesDisplayStyle {
  return value === 'numbers' || value === 'stars';
}

async function hydrateStyle(): Promise<CategoryAveragesDisplayStyle> {
  if (hydrated) return cachedStyle;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (isStyle(raw)) {
        cachedStyle = raw;
      }
    } catch {
      // keep cached default
    } finally {
      hydrated = true;
      hydratePromise = null;
    }
    return cachedStyle;
  })();
  return hydratePromise;
}

async function persistStyle(next: CategoryAveragesDisplayStyle): Promise<void> {
  cachedStyle = next;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Preference still held in memory for this session.
  }
}

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
    ? i18n.t('settings.passport.showAsNumbers')
    : i18n.t('settings.passport.showAsStars');
}

export function PassportDisplaySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { i18n: i18nInstance } = useTranslation();
  // Prefer module cache (already hydrated) over hardcoded default.
  const [categoryAveragesStyle, setCategoryAveragesStyle] =
    useState<CategoryAveragesDisplayStyle>(cachedStyle);
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const style = await hydrateStyle();
      if (cancelled) return;
      setCategoryAveragesStyle(style);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCategoryAveragesStyle = useCallback(() => {
    setCategoryAveragesStyle((current) => {
      const next: CategoryAveragesDisplayStyle =
        current === 'numbers' ? 'stars' : 'numbers';
      void persistStyle(next);
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
    [
      categoryAveragesStyle,
      toggleCategoryAveragesStyle,
      ready,
      i18nInstance.language,
    ],
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
