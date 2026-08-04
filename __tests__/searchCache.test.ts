import { MAX_NEARBY_SEARCH_RADIUS_M } from '@/services/places/searchRadii';
import {
  bucketKey,
  cached,
  clearSearchCache,
  resolveCache,
} from '@/services/places/searchCache';
import type { RestaurantSearchResult } from '@/services/places/types';

const GENT = { latitude: 51.05, longitude: 3.72 };

function result(name: string): RestaurantSearchResult {
  return {
    id: `place_${name}`,
    name,
    city: 'Gent',
    country: 'BE',
    streetAddress: 'Straat 1',
    phoneNumber: '',
    coordinate: GENT,
    mapItemIdentifier: `place_${name}`,
    distanceMeters: null,
    primaryType: 'restaurant',
  };
}

beforeEach(() => {
  clearSearchCache();
});

describe('search cache radius awareness', () => {
  it('buckets the same query at different radii separately', () => {
    expect(bucketKey(GENT, '__nearby__', 2_000)).not.toBe(
      bucketKey(GENT, '__nearby__', 50_000),
    );
  });

  it('buckets the same query with and without a region code separately', () => {
    expect(bucketKey(null, 'brussel', 2_000, 'BE')).not.toBe(
      bucketKey(null, 'brussel', 2_000),
    );
    // The city-only retry with a dining qualifier must never be served from
    // the empty region-scoped cache bucket (different query string).
    expect(bucketKey(null, 'brussel', 2_000, 'BE')).not.toBe(
      bucketKey(null, 'brussel restaurant', 2_000),
    );
  });

  it('rounds the radius into stable 100 m buckets', () => {
    expect(bucketKey(GENT, 'q', 2_010)).toBe(bucketKey(GENT, 'q', 2_040));
    expect(bucketKey(GENT, 'q', 50_000)).toBe(bucketKey(GENT, 'q', 50_049));
  });

  it('does not serve a wider request from a narrower cached result', async () => {
    await resolveCache(GENT, '__nearby__', 2_000, async () => [result('A')]);
    // Same center/query but a larger radius may contain places beyond the
    // cached 2 km circle, so the narrow entry must not satisfy it.
    expect(cached(GENT, '__nearby__', 50_000)).toBeNull();
  });

  it('serves a narrower request from a wider cached result (superset)', async () => {
    await resolveCache(GENT, '__nearby__', 50_000, async () => [result('A')]);
    // Google returns the 20 closest places within the radius, so a 50 km
    // result set already contains everything a 2 km request would return.
    const hit = cached(GENT, '__nearby__', 2_000);
    expect(hit).not.toBeNull();
    expect(hit?.[0]?.name).toBe('A');
  });

  it('deduplicates concurrent identical requests (same bucket)', async () => {
    let calls = 0;
    const work = async () => {
      calls += 1;
      return [result('A')];
    };
    const [a, b] = await Promise.all([
      resolveCache(GENT, 'q', 2_000, work),
      resolveCache(GENT, 'q', 2_000, work),
    ]);
    expect(calls).toBe(1);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('runs separate work for different radii', async () => {
    const near = await resolveCache(GENT, '__nearby__', 2_000, async () => [
      result('N'),
    ]);
    const wide = await resolveCache(GENT, '__nearby__', 50_000, async () => [
      result('W'),
    ]);
    expect(near[0]?.name).toBe('N');
    expect(wide[0]?.name).toBe('W');
  });

  it('does not serve a nearby request from a distant center', async () => {
    await resolveCache(GENT, '__nearby__', 2_000, async () => [result('A')]);
    const far = { latitude: 51.2, longitude: 3.8 }; // ~19 km away
    expect(cached(far, '__nearby__', 2_000)).toBeNull();
  });
});

describe('MAX_NEARBY_SEARCH_RADIUS_M', () => {
  it('is the Places API hard cap (50 km)', () => {
    expect(MAX_NEARBY_SEARCH_RADIUS_M).toBe(50_000);
  });
});
