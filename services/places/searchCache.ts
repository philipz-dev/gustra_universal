import { distanceMeters } from '@/services/places/distance';
import type { LatLng, RestaurantSearchResult } from '@/services/places/types';

/**
 * In-memory search-result cache, kept in a pure module so the radius-aware
 * hit logic can be unit-tested without pulling in the Google Places
 * networking stack (expo-constants etc.).
 */

type CacheEntry = {
  center: LatLng;
  query: string;
  /** Meters — results for a wider radius must not satisfy a narrower request. */
  radius: number;
  timestamp: number;
  results: RestaurantSearchResult[];
};

const cacheEntries: CacheEntry[] = [];
const inFlight = new Map<string, Promise<RestaurantSearchResult[]>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_RADIUS_M = 100;

export function bucketKey(
  center: LatLng | null,
  query: string,
  radius: number,
  extras: string = '',
): string {
  const lat = center ? Math.round(center.latitude * 1000) / 1000 : 'none';
  const lng = center ? Math.round(center.longitude * 1000) / 1000 : 'none';
  // v3: optional locationBias + regionCode for country-scoped manual search.
  return `v3:${query}@${lat},${lng}|r=${Math.round(radius / 100) * 100}${
    extras ? `:${extras}` : ''
  }`;
}

export function cached(
  center: LatLng | null,
  query: string,
  radius: number,
): RestaurantSearchResult[] | null {
  const now = Date.now();
  for (let i = cacheEntries.length - 1; i >= 0; i -= 1) {
    if (now - cacheEntries[i]!.timestamp > CACHE_TTL_MS) {
      cacheEntries.splice(i, 1);
    }
  }
  const hit = cacheEntries.find((entry) => {
    if (entry.query !== query) return false;
    // A wider radius returns more results than a narrower one, so a cache
    // entry may only serve requests asking for at least that much radius.
    if (entry.radius < radius) return false;
    if (!center) return entry.center.latitude === 0 && entry.center.longitude === 0;
    return distanceMeters(entry.center, center) <= CACHE_RADIUS_M;
  });
  return hit?.results ?? null;
}

export async function resolveCache(
  center: LatLng | null,
  query: string,
  radius: number,
  work: () => Promise<RestaurantSearchResult[]>,
  extras: string = '',
): Promise<RestaurantSearchResult[]> {
  const hit = cached(center, query, radius);
  if (hit) return hit;

  const key = bucketKey(center, query, radius, extras);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const results = await work();
    cacheEntries.push({
      center: center ?? { latitude: 0, longitude: 0 },
      query,
      radius,
      timestamp: Date.now(),
      results,
    });
    return results;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

/** Test helper: drop all cache entries and in-flight requests. */
export function clearSearchCache(): void {
  cacheEntries.splice(0, cacheEntries.length);
  inFlight.clear();
}
