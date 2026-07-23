import { GoogleAPIConfig } from '@/constants/GoogleAPIConfig';
import { incrementGoogleApi } from '@/services/google/GoogleApiTracker';
import type {
  LatLng,
  RestaurantSearchResult,
} from '@/services/places/types';

export const DEFAULT_SEARCH_RADIUS_M = 2_000;

const FOOD_INCLUDED_TYPES = [
  'restaurant',
  'cafe',
  'bakery',
  'bar',
  'meal_takeaway',
] as const;

/** Local filter for text search (Swift `foodPlaceTypes`). */
const FOOD_PLACE_TYPES = new Set([
  'food',
  'restaurant',
  'cafe',
  'bakery',
  'bar',
  'pub',
  'meal_takeaway',
  'meal_delivery',
  'snack_bar',
  'fast_food_restaurant',
  'food_court',
  'ice_cream_shop',
  'sandwich_shop',
  'deli',
  'pizza_restaurant',
]);

const FIELD_MASK =
  'places.id,places.displayName,places.location,places.formattedAddress,places.addressComponents,places.types,places.primaryType,places.nationalPhoneNumber,places.internationalPhoneNumber';

type PlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];
  types?: string[];
  primaryType?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
};

type PlacesApiResponse = {
  places?: PlacesApiPlace[];
  error?: { message?: string; status?: string };
};

export class RestaurantSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestaurantSearchError';
  }
}

/** Haversine distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Swift `RestaurantSearchService.formattedDistance`. */
export function formattedDistance(meters: number): string {
  const rounded = Math.round(meters / 10) * 10;
  if (rounded >= 1000) {
    const km = rounded / 1000;
    const digits = rounded >= 1000 ? 1 : 0;
    return `${km.toFixed(digits)} km`;
  }
  return `${rounded} m`;
}

type CacheEntry = {
  center: LatLng;
  query: string;
  timestamp: number;
  results: RestaurantSearchResult[];
};

const cacheEntries: CacheEntry[] = [];
const inFlight = new Map<string, Promise<RestaurantSearchResult[]>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_RADIUS_M = 100;

function bucketKey(center: LatLng, query: string): string {
  const lat = Math.round(center.latitude * 1000) / 1000;
  const lng = Math.round(center.longitude * 1000) / 1000;
  // v2: field mask includes phone numbers.
  return `v2:${query}@${lat},${lng}`;
}

function cached(center: LatLng, query: string): RestaurantSearchResult[] | null {
  const now = Date.now();
  for (let i = cacheEntries.length - 1; i >= 0; i -= 1) {
    if (now - cacheEntries[i]!.timestamp > CACHE_TTL_MS) {
      cacheEntries.splice(i, 1);
    }
  }
  const hit = cacheEntries.find(
    (entry) =>
      entry.query === query &&
      distanceMeters(entry.center, center) <= CACHE_RADIUS_M,
  );
  return hit?.results ?? null;
}

async function resolveCache(
  center: LatLng,
  query: string,
  work: () => Promise<RestaurantSearchResult[]>,
): Promise<RestaurantSearchResult[]> {
  const hit = cached(center, query);
  if (hit) return hit;

  const key = bucketKey(center, query);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const results = await work();
    cacheEntries.push({
      center,
      query,
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

function componentOf(
  components: PlacesApiPlace['addressComponents'],
  type: string,
): string {
  return (
    components?.find((c) => c.types?.includes(type))?.longText?.trim() ?? ''
  );
}

function makeResult(
  place: PlacesApiPlace,
  restrictToFood = false,
): RestaurantSearchResult | null {
  const name = place.displayName?.text?.trim() ?? '';
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!name || latitude == null || longitude == null) return null;

  if (restrictToFood) {
    const types = place.types ?? [];
    const isFood = types.some((type) => FOOD_PLACE_TYPES.has(type));
    if (!isFood) return null;
  }

  const components = place.addressComponents;
  const city =
    componentOf(components, 'locality') ||
    componentOf(components, 'postal_town') ||
    componentOf(components, 'administrative_area_level_2') ||
    '';
  const country = componentOf(components, 'country');
  const primaryType = place.primaryType?.trim() ?? '';
  const phoneNumber =
    place.internationalPhoneNumber?.trim() ||
    place.nationalPhoneNumber?.trim() ||
    '';

  return {
    id: place.id ?? `${name}-${latitude}-${longitude}`,
    name,
    city,
    country,
    streetAddress: place.formattedAddress ?? '',
    phoneNumber,
    coordinate: { latitude, longitude },
    mapItemIdentifier: place.id ?? null,
    distanceMeters: null,
    primaryType,
  };
}

function withDistance(
  results: RestaurantSearchResult[],
  origin: LatLng,
): RestaurantSearchResult[] {
  return results
    .map((result) => ({
      ...result,
      distanceMeters: distanceMeters(origin, result.coordinate),
    }))
    .sort(
      (a, b) =>
        (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
        (b.distanceMeters ?? Number.POSITIVE_INFINITY),
    );
}

async function postPlaces(
  path: 'places:searchNearby' | 'places:searchText',
  body: Record<string, unknown>,
  restrictToFood = false,
): Promise<RestaurantSearchResult[]> {
  let apiKey: string;
  try {
    apiKey = GoogleAPIConfig.requireApiKey();
  } catch (error) {
    throw new RestaurantSearchError(
      error instanceof Error ? error.message : 'Google API key is missing.',
    );
  }

  const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as PlacesApiResponse;
  if (!response.ok) {
    const message = data.error?.message;
    throw new RestaurantSearchError(
      message
        ? `${message} (${response.status})`
        : `Restaurant search failed (${response.status}).`,
    );
  }

  void incrementGoogleApi('places');

  return (data.places ?? [])
    .map((place) => makeResult(place, restrictToFood))
    .filter((item): item is RestaurantSearchResult => item != null);
}

async function postNearby(
  center: LatLng,
  radius: number,
): Promise<RestaurantSearchResult[]> {
  return postPlaces('places:searchNearby', {
    includedTypes: [...FOOD_INCLUDED_TYPES],
    maxResultCount: 20,
    rankPreference: 'DISTANCE',
    locationRestriction: {
      circle: {
        center: {
          latitude: center.latitude,
          longitude: center.longitude,
        },
        radius,
      },
    },
  });
}

async function postText(
  query: string,
  center: LatLng,
  radius: number,
): Promise<RestaurantSearchResult[]> {
  return postPlaces(
    'places:searchText',
    {
      textQuery: query,
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: {
            latitude: center.latitude,
            longitude: center.longitude,
          },
          radius,
        },
      },
    },
    true,
  );
}

function normalizedPlaceID(placeID: string): string | null {
  let value = placeID.trim();
  if (!value) return null;
  if (value.startsWith('places/')) {
    value = value.slice('places/'.length);
  }
  return value || null;
}

/**
 * Place Details (New): fetch only `primaryType` (Swift `fetchPrimaryType`).
 */
export async function fetchPrimaryType(placeID: string): Promise<string | null> {
  let apiKey: string;
  try {
    apiKey = GoogleAPIConfig.requireApiKey();
  } catch (error) {
    throw new RestaurantSearchError(
      error instanceof Error ? error.message : 'Google API key is missing.',
    );
  }
  const idOnly = normalizedPlaceID(placeID);
  if (!idOnly) {
    throw new RestaurantSearchError('Invalid place ID.');
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(idOnly)}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'primaryType',
      },
    },
  );

  const data = (await response.json()) as PlacesApiPlace & PlacesApiResponse;
  if (!response.ok) {
    const message = data.error?.message;
    throw new RestaurantSearchError(
      message
        ? `${message} (${response.status})`
        : `Place Details failed (${response.status}).`,
    );
  }

  void incrementGoogleApi('places');

  const type = data.primaryType?.trim() ?? '';
  return type || null;
}

/**
 * Nearby food places (Swift `RestaurantSearchService.searchNearby`).
 */
export async function searchNearby(
  center: LatLng,
  radius: number = DEFAULT_SEARCH_RADIUS_M,
): Promise<RestaurantSearchResult[]> {
  const results = await resolveCache(center, '__nearby__', () =>
    postNearby(center, radius),
  );
  return withDistance(results, center);
}

/**
 * Text search around a center (Swift `RestaurantSearchService.searchText`).
 */
export async function searchText(
  query: string,
  center: LatLng,
  radius: number = DEFAULT_SEARCH_RADIUS_M,
): Promise<RestaurantSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return searchNearby(center, radius);
  }
  const results = await resolveCache(center, trimmed.toLowerCase(), () =>
    postText(trimmed, center, radius),
  );
  return withDistance(results, center);
}
