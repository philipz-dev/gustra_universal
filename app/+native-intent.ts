/**
 * Expo Router entry for system URLs (Share Extension → `gustra://expo-sharing`).
 * Keep navigation on a real route; ShareImportLaunch consumes the App Group payload.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const url = path.includes('://') ? new URL(path) : new URL(path, 'gustra://');
    const host = url.hostname.toLowerCase();
    if (host === 'expo-sharing' || host === 'import-share') {
      return '/(tabs)/(main)';
    }
  } catch {
    // fall through
  }
  return path;
}
