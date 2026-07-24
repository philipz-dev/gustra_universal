import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import it from '@/i18n/locales/it.json';
import nl from '@/i18n/locales/nl.json';
import {
  resolveAppLanguage,
  type LanguagePreference,
} from '@/i18n/resolveLanguage';

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    it: { translation: it },
    nl: { translation: nl },
  },
  lng: resolveAppLanguage('system'),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export async function applyLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  const language = resolveAppLanguage(preference);
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
}

export { i18n };
export default i18n;
