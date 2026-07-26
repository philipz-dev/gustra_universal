import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoogleApiKind = 'maps' | 'places' | 'gemini';

export type GoogleApiUsageSnapshot = {
  mapsToday: number;
  mapsTotal: number;
  placesToday: number;
  placesTotal: number;
  geminiToday: number;
  geminiTotal: number;
};

type Listener = (snapshot: GoogleApiUsageSnapshot) => void;

const DAY_KEY = 'google_api_day_key';

function totalKey(kind: GoogleApiKind): string {
  return `google_api_${kind}_total`;
}

function todayKey(kind: GoogleApiKind): string {
  return `google_api_${kind}_today`;
}

function currentDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let snapshot: GoogleApiUsageSnapshot = {
  mapsToday: 0,
  mapsTotal: 0,
  placesToday: 0,
  placesTotal: 0,
  geminiToday: 0,
  geminiTotal: 0,
};
let ready = false;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(snapshot);
}

async function readInt(key: string): Promise<number> {
  const raw = await AsyncStorage.getItem(key);
  const n = raw == null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function rolloverIfNeeded(): Promise<void> {
  const today = currentDayKey();
  const stored = await AsyncStorage.getItem(DAY_KEY);
  if (stored === today) return;
  await AsyncStorage.multiRemove([
    todayKey('maps'),
    todayKey('places'),
    todayKey('gemini'),
  ]);
  await AsyncStorage.setItem(DAY_KEY, today);
}

async function reload(): Promise<void> {
  const [
    mapsTotal,
    mapsToday,
    placesTotal,
    placesToday,
    geminiTotal,
    geminiToday,
  ] = await Promise.all([
    readInt(totalKey('maps')),
    readInt(todayKey('maps')),
    readInt(totalKey('places')),
    readInt(todayKey('places')),
    readInt(totalKey('gemini')),
    readInt(todayKey('gemini')),
  ]);
  snapshot = {
    mapsTotal,
    mapsToday,
    placesTotal,
    placesToday,
    geminiTotal,
    geminiToday,
  };
  notify();
}

/** Load counters from disk (safe to call multiple times). */
export function hydrateGoogleApiTracker(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      await rolloverIfNeeded();
      await reload();
      ready = true;
    })();
  }
  return hydratePromise;
}

export function getGoogleApiUsageSnapshot(): GoogleApiUsageSnapshot {
  return snapshot;
}

export function subscribeGoogleApiTracker(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Increment a successful Google API call (Swift `GoogleApiTracker.increment`).
 * Places: searchNearby / searchText / Place Details.
 * Maps: Maps JS / SDK map load.
 * Gemini: wine-label Vision identify.
 */
export async function incrementGoogleApi(kind: GoogleApiKind): Promise<void> {
  await hydrateGoogleApiTracker();
  await rolloverIfNeeded();
  const nextTotal = (await readInt(totalKey(kind))) + 1;
  const nextToday = (await readInt(todayKey(kind))) + 1;
  await AsyncStorage.multiSet([
    [totalKey(kind), String(nextTotal)],
    [todayKey(kind), String(nextToday)],
  ]);
  if (kind === 'maps') {
    snapshot = { ...snapshot, mapsTotal: nextTotal, mapsToday: nextToday };
  } else if (kind === 'places') {
    snapshot = { ...snapshot, placesTotal: nextTotal, placesToday: nextToday };
  } else {
    snapshot = { ...snapshot, geminiTotal: nextTotal, geminiToday: nextToday };
  }
  notify();
}

export async function resetGoogleApiCounters(): Promise<void> {
  await hydrateGoogleApiTracker();
  await AsyncStorage.multiRemove([
    totalKey('maps'),
    todayKey('maps'),
    totalKey('places'),
    todayKey('places'),
    totalKey('gemini'),
    todayKey('gemini'),
  ]);
  await AsyncStorage.setItem(DAY_KEY, currentDayKey());
  snapshot = {
    mapsToday: 0,
    mapsTotal: 0,
    placesToday: 0,
    placesTotal: 0,
    geminiToday: 0,
    geminiTotal: 0,
  };
  notify();
}

export function isGoogleApiTrackerReady(): boolean {
  return ready;
}
