/**
 * Jest stub for `expo-localization` — unit tests run in node without the
 * native module. `getLocales` returns a single English locale.
 */
export function getLocales() {
  return [{ languageCode: 'en', languageTag: 'en-US' }];
}
