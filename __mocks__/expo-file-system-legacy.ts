/**
 * Minimal `expo-file-system/legacy` mock for pure-logic Jest tests.
 * Only what `services/backup/photos.ts` and `services/photos/orphanCleanup.ts`
 * touch at import time: `documentDirectory` and the `getInfoAsync` helper.
 * The mock also exposes `__mockFile` / `__resetMockFiles` test helpers.
 */
const EXISTING_FILES = new Set<string>();

export const documentDirectory = '/mock/documents/';

export async function getInfoAsync(
  uri: string,
): Promise<{ exists: boolean; isDirectory: boolean }> {
  const path = uri.replace('file://', '');
  return {
    exists: EXISTING_FILES.has(path),
    isDirectory: false,
  };
}

export async function readDirectoryAsync(_dir: string): Promise<string[]> {
  return [];
}

export async function deleteAsync(_uri: string, _options?: unknown): Promise<void> {
  return;
}

export async function makeDirectoryAsync(
  _uri: string,
  _options?: unknown,
): Promise<void> {
  return;
}

export async function readAsStringAsync(
  _uri: string,
  _options?: unknown,
): Promise<string> {
  return '';
}

export async function writeAsStringAsync(
  _uri: string,
  _content: string,
  _options?: unknown,
): Promise<void> {
  return;
}

export const EncodingType = {
  Base64: 'base64',
  UTF8: 'utf8',
};

/** Test helper — mark a file as present on the fake disk. */
export function __mockFile(path: string): void {
  EXISTING_FILES.add(path.replace('file://', ''));
}

export function __resetMockFiles(): void {
  EXISTING_FILES.clear();
}
