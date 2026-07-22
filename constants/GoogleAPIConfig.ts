import Constants from 'expo-constants';

/**
 * Google Places / Maps API key (Swift `GoogleAPIConfig`).
 * Same local-dev key as iOS; override via `expo.extra` or `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`.
 */
const SWIFT_DEV_API_KEY = 'AIzaSyC7hqAvSuoAw3IXFpiqTGZmGKgW-vazlL4';

function readApiKey(): string {
  const extra = Constants.expoConfig?.extra as
    | { googlePlacesApiKey?: string }
    | undefined;
  const fromExtra = extra?.googlePlacesApiKey?.trim();
  if (fromExtra) return fromExtra;

  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  return SWIFT_DEV_API_KEY;
}

export const GoogleAPIConfig = {
  get apiKey(): string {
    return readApiKey();
  },
};
