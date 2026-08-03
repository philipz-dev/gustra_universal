import Constants from 'expo-constants';

/**
 * Google Places / Maps API key (Swift `GoogleAPIConfig`).
 * Loaded from local `.env` → `EXPO_PUBLIC_GOOGLE_API_KEY` (never hardcode).
 */
function readApiKey(): string {
  const extra = Constants.expoConfig?.extra as
    | { googlePlacesApiKey?: string; googleApiKey?: string }
    | undefined;
  const fromExtra =
    extra?.googleApiKey?.trim() || extra?.googlePlacesApiKey?.trim();
  if (fromExtra) return fromExtra;

  const env: Record<string, string | undefined> =
    typeof process === 'undefined' ? {} : process.env;
  const fromEnv =
    env.EXPO_PUBLIC_GOOGLE_API_KEY?.trim() ||
    env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  return '';
}

export const GoogleAPIConfig = {
  get apiKey(): string {
    return readApiKey();
  },

  /** True when a non-empty key is available at runtime. */
  get isConfigured(): boolean {
    return readApiKey().length > 0;
  },

  /**
   * Throws a clear setup error when the key is missing.
   * Prefer this at Places/Maps call sites over silent empty strings.
   */
  requireApiKey(): string {
    const key = readApiKey();
    if (!key) {
      throw new Error(
        'Google Places/Maps API key is missing. Copy .env.example to .env and set EXPO_PUBLIC_GOOGLE_API_KEY, then restart Expo.',
      );
    }
    return key;
  },
};
