import { getLocales } from 'expo-localization';

export type AppLanguage = 'de' | 'en' | 'es' | 'fr' | 'it' | 'nl';
export type LanguagePreference = 'system' | AppLanguage;

/** App languages shown in Settings (endonyms), alphabetical by native name. */
export const APP_LANGUAGES: readonly AppLanguage[] = [
  'de',
  'en',
  'es',
  'fr',
  'it',
  'nl',
];

const APP_LANGUAGE_SET = new Set<string>(APP_LANGUAGES);

export function isAppLanguage(value: string): value is AppLanguage {
  return APP_LANGUAGE_SET.has(value);
}

/** Map device locales + optional Settings override → app catalog language. */
export function resolveAppLanguage(
  preference: LanguagePreference = 'system',
): AppLanguage {
  if (isAppLanguage(preference)) {
    return preference;
  }

  const locales = getLocales();
  for (const locale of locales) {
    const code = (locale.languageCode ?? '').toLowerCase();
    if (isAppLanguage(code)) {
      return code;
    }
  }
  return 'en';
}

/** BCP-47 tag for `Intl` date formatting. */
export function resolveIntlLocale(language: AppLanguage): string {
  const locales = getLocales();
  const match = locales.find(
    (l) => (l.languageCode ?? '').toLowerCase() === language,
  );
  if (match?.languageTag) return match.languageTag;

  switch (language) {
    case 'nl':
      return 'nl-BE';
    case 'it':
      return 'it-IT';
    case 'de':
      return 'de-DE';
    case 'es':
      return 'es-ES';
    case 'fr':
      return 'fr-FR';
    default:
      return 'en';
  }
}
