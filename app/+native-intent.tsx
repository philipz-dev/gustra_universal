/**
 * Android opens `.gustrashare` via `content://` / `file://` intents.
 * Expo Router would treat those as routes → "+not-found".
 * Rewrite to `/`; `ShareImportLaunchProvider` still loads the file via Linking.
 *
 * @see https://docs.expo.dev/router/advanced/native-intent/
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const raw = (path ?? '').trim();
    if (!raw) return '/';

    const lower = raw.toLowerCase();
    if (
      lower.startsWith('content:') ||
      lower.startsWith('file:') ||
      lower.includes('content://') ||
      lower.includes('import-share') ||
      lower.endsWith('.gustrashare') ||
      /\.gustrashare(\?|#|$)/i.test(raw)
    ) {
      return '/';
    }

    // Absolute URL with a non-app scheme (e.g. content:/file:)
    try {
      const url = new URL(raw);
      const protocol = url.protocol.replace(':', '').toLowerCase();
      if (protocol === 'content' || protocol === 'file') {
        return '/';
      }
      if (protocol === 'gustra' && url.hostname.toLowerCase() === 'import-share') {
        return '/';
      }
    } catch {
      // Relative paths fall through.
    }

    return path;
  } catch {
    return '/';
  }
}
