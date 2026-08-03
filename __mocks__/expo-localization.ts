/**
 * Jest stub for `expo-localization` — unit tests run in node without the
 * native module. `getLocales` returns a single English (metric) locale.
 */
export function getLocales() {
  return [{ languageCode: 'en', languageTag: 'en-US', measurementSystem: 'metric' }];
}
