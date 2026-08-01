/**
 * Jest stub for `@/i18n` — unit tests exercise pure logic only, never the
 * i18next/Expo bootstrap. `t()` returns the key so label-mapping functions
 * (e.g. `ratingLabel`) stay assertable.
 */
export const i18n = {
  t: (key: string): string => key,
  language: 'en',
  changeLanguage: async (): Promise<void> => {},
};

export default i18n;
