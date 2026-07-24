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
import { AppState, Platform } from 'react-native';

import { applyLanguagePreference } from '@/i18n';
import {
  isAppLanguage,
  resolveAppLanguage,
  resolveIntlLocale,
  type AppLanguage,
  type LanguagePreference,
} from '@/i18n/resolveLanguage';

const STORAGE_KEY = 'gustra.languagePreference';

type LanguageSettingsValue = {
  preference: LanguagePreference;
  language: AppLanguage;
  intlLocale: string;
  setPreference: (next: LanguagePreference) => void;
  ready: boolean;
};

const LanguageSettingsContext = createContext<LanguageSettingsValue | null>(
  null,
);

function isPreference(value: string | null): value is LanguagePreference {
  return value === 'system' || isAppLanguage(value ?? '');
}

export function LanguageSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preference, setPreferenceState] =
    useState<LanguagePreference>('system');
  const [ready, setReady] = useState(false);
  /** Bumps when device locale may have changed (Android + system preference). */
  const [localeEpoch, setLocaleEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isPreference(raw)) {
          setPreferenceState(raw);
          await applyLanguagePreference(raw);
        } else {
          await applyLanguagePreference('system');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Android can change device locale without restarting the app.
  useEffect(() => {
    if (Platform.OS !== 'android' || preference !== 'system') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void applyLanguagePreference('system').then(() => {
          setLocaleEpoch((n) => n + 1);
        });
      }
    });
    return () => sub.remove();
  }, [preference]);

  const setPreference = useCallback((next: LanguagePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
    void applyLanguagePreference(next);
  }, []);

  const language = resolveAppLanguage(preference);
  const intlLocale = resolveIntlLocale(language);

  const value = useMemo(
    () => ({
      preference,
      language,
      intlLocale,
      setPreference,
      ready,
    }),
    // localeEpoch forces recomputation after Android system-locale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    [preference, language, intlLocale, setPreference, ready, localeEpoch],
  );

  return (
    <LanguageSettingsContext.Provider value={value}>
      {children}
    </LanguageSettingsContext.Provider>
  );
}

export function useLanguageSettings(): LanguageSettingsValue {
  const ctx = useContext(LanguageSettingsContext);
  if (!ctx) {
    throw new Error(
      'useLanguageSettings must be used within LanguageSettingsProvider',
    );
  }
  return ctx;
}
