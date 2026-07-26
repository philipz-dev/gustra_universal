import { Platform } from 'react-native';

/**
 * On-device OCR for review photos (Swift `OCRService` / Vision).
 * Uses `expo-ocr-kit` (Vision on iOS, ML Kit on Android).
 * Gracefully no-ops in Expo Go / web when the native module is unavailable.
 */

let nativeChecked = false;
let nativeUsable = false;

async function loadRecognizer(): Promise<
  ((uri: string) => Promise<{ text?: string }>) | null
> {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('expo-ocr-kit');
    if (typeof mod.recognizeText !== 'function') return null;
    nativeUsable = true;
    nativeChecked = true;
    return mod.recognizeText;
  } catch {
    nativeUsable = false;
    nativeChecked = true;
    return null;
  }
}

/** True when a native OCR engine is linked (dev client / production build). */
export function isOcrAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (nativeChecked) return nativeUsable;
  // Synchronous probe — Metro resolves the package; native call may still fail later.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-ocr-kit');
    return true;
  } catch {
    return false;
  }
}

type ExtractOptions = {
  /** When false, keep line breaks (wine label display). Default: collapse. */
  collapseWhitespace?: boolean;
};

/** Extract text from a single local image URI. */
export async function extractTextFromImage(
  imageUri: string,
  options?: ExtractOptions,
): Promise<string> {
  const uri = imageUri.trim();
  if (!uri) return '';

  const recognize = await loadRecognizer();
  if (!recognize) return '';

  try {
    const result = await recognize(uri);
    const text = result?.text ?? '';
    if (options?.collapseWhitespace === false) {
      return text.replace(/\r\n/g, '\n').trim();
    }
    return text.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

/** OCR all photos and join (Swift `indexPhotos`). */
export async function extractTextFromImages(
  imageUris: string[],
): Promise<string> {
  const combined: string[] = [];
  for (const uri of imageUris) {
    const text = await extractTextFromImage(uri);
    if (text) combined.push(text);
  }
  return combined.join(' ');
}
