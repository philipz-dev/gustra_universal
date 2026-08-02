/**
 * Ambient types for the `expo-file-system/legacy` Jest mock
 * (see `jest.config.js` moduleNameMapper + `__mocks__/expo-file-system-legacy.ts`).
 */
declare module 'expo-file-system/legacy' {
  export const documentDirectory: string;
  export function getInfoAsync(
    uri: string,
  ): Promise<{ exists: boolean; isDirectory: boolean }>;
  export function readDirectoryAsync(dir: string): Promise<string[]>;
  export function deleteAsync(
    uri: string,
    options?: { idempotent?: boolean },
  ): Promise<void>;
  export function makeDirectoryAsync(
    uri: string,
    options?: { intermediates?: boolean },
  ): Promise<void>;
  export function readAsStringAsync(
    uri: string,
    options?: { encoding?: string },
  ): Promise<string>;
  export function writeAsStringAsync(
    uri: string,
    content: string,
    options?: { encoding?: string },
  ): Promise<void>;
  export const EncodingType: { Base64: string; UTF8: string };
  export function __mockFile(path: string): void;
  export function __resetMockFiles(): void;
}
