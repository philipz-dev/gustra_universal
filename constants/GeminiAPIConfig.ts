import Constants from 'expo-constants';

/**
 * Google Gemini API key for wine-label Vision (local `.env` only).
 * `EXPO_PUBLIC_GEMINI_API_KEY` — never hardcode; prefer a server proxy for production.
 */
function readApiKey(): string {
  const extra = Constants.expoConfig?.extra as
    | { geminiApiKey?: string }
    | undefined;
  const fromExtra = extra?.geminiApiKey?.trim();
  if (fromExtra) return fromExtra;

  const fromEnv = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  return '';
}

export const GeminiAPIConfig = {
  get apiKey(): string {
    return readApiKey();
  },

  get isConfigured(): boolean {
    return readApiKey().length > 0;
  },

  requireApiKey(): string {
    const key = readApiKey();
    if (!key) {
      throw new Error(
        'Gemini API key is missing. Copy .env.example to .env and set EXPO_PUBLIC_GEMINI_API_KEY, then restart Expo.',
      );
    }
    return key;
  },
};
