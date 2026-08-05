import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * “Save review photos to the device photo library” preference.
 *
 * Default ON (user asked): every saved review photo is also written to the
 * system photo library (iOS Photos / Android Media Store → Google Photos).
 * The user can switch it off in Settings; the app folder stays the source of
 * truth for the memory and backups either way.
 */
export const PHOTO_LIBRARY_SAVE_KEY = 'saveReviewPhotosToDeviceLibrary';

type Listener = (enabled: boolean) => void;

let cachedEnabled = true;
let hydrated = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(cachedEnabled);
}

export function subscribePhotoLibrarySave(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isPhotoLibrarySaveEnabled(): boolean {
  return cachedEnabled;
}

export function isPhotoLibrarySaveHydrated(): boolean {
  return hydrated;
}

export async function hydratePhotoLibrarySave(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_LIBRARY_SAVE_KEY);
    if (raw === null) {
      cachedEnabled = true;
    } else {
      cachedEnabled = raw === 'true' || raw === '1';
    }
  } catch {
    cachedEnabled = true;
  }
  hydrated = true;
  notify();
  return cachedEnabled;
}

export async function setPhotoLibrarySaveEnabled(enabled: boolean): Promise<void> {
  cachedEnabled = enabled;
  hydrated = true;
  notify();
  try {
    await AsyncStorage.setItem(
      PHOTO_LIBRARY_SAVE_KEY,
      enabled ? 'true' : 'false',
    );
  } catch {
    // Preference still held in memory for this session.
  }
}
