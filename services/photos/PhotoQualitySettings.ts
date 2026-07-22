import AsyncStorage from '@react-native-async-storage/async-storage';

/** Matches Swift `PhotoQualitySettings.storageKey`. */
export const PHOTO_DATA_SAVINGS_KEY = 'photoDataSavingsEnabled';

/** Matches Swift `ImageCompressionService.matchingReviewPhotoMaxPixelSide`. */
export const REVIEW_PHOTO_BASE_MAX_SIDE = 480;

type Listener = (enabled: boolean) => void;

let cachedEnabled = false;
let hydrated = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(cachedEnabled);
}

/** Subscribe to data-savings changes (Settings + photo save). */
export function subscribePhotoDataSavings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPhotoDataSavingsEnabled(): boolean {
  return cachedEnabled;
}

/** Linear scale: savings = 1× (480), normal = 2× (960) — Swift `storageScaleFactor`. */
export function reviewPhotoMaxPixelSide(): number {
  return cachedEnabled
    ? REVIEW_PHOTO_BASE_MAX_SIDE
    : REVIEW_PHOTO_BASE_MAX_SIDE * 2;
}

export async function hydratePhotoDataSavings(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_DATA_SAVINGS_KEY);
    if (raw === null) {
      cachedEnabled = false;
    } else {
      cachedEnabled = raw === 'true' || raw === '1';
    }
  } catch {
    cachedEnabled = false;
  }
  hydrated = true;
  notify();
  return cachedEnabled;
}

export function isPhotoDataSavingsHydrated(): boolean {
  return hydrated;
}

export async function setPhotoDataSavingsEnabled(
  enabled: boolean,
): Promise<void> {
  cachedEnabled = enabled;
  notify();
  await AsyncStorage.setItem(PHOTO_DATA_SAVINGS_KEY, enabled ? 'true' : 'false');
}
