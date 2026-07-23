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

function bucketKey(
  center: LatLng | null,
  query: string,
  extras: string = '',
): string {
  const lat = center ? Math.round(center.latitude * 1000) / 1000 : 'none';
  const lng = center ? Math.round(center.longitude * 1000) / 1000 : 'none';
  // v3: optional locationBias + regionCode for country-scoped manual search.
  return `v3:${query}@${lat},${lng}${extras ? `:${extras}` : ''}`;
}

function cached(
  center: LatLng | null,
  query: string,
): RestaurantSearchResult[] | null {
  const now = Date.now();
  for (let i = cacheEntries.length - 1; i >= 0; i -= 1) {
    if (now - cacheEntries[i]!.timestamp > CACHE_TTL_MS) {
      cacheEntries.splice(i, 1);
    }
  }
  const hit = cacheEntries.find((entry) => {
    if (entry.query !== query) return false;
    if (!center) return entry.center.latitude === 0 && entry.center.longitude === 0;
    return distanceMeters(entry.center, center) <= CACHE_RADIUS_M;
  });
  return hit?.results ?? null;
}

async function resolveCache(
  center: LatLng | null,
  query: string,
  work: () => Promise<RestaurantSearchResult[]>,
  extras: string = '',
): Promise<RestaurantSearchResult[]> {
  const hit = cached(center, query);
  if (hit) return hit;

  const key = bucketKey(center, query, extras);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const results = await work();
    cacheEntries.push({
      center: center ?? { latitude: 0, longitude: 0 },
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
  center: LatLng | null,
  radius: number,
  regionCode?: string,
): Promise<RestaurantSearchResult[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 20,
  };

  // Soft GPS bias only when useful. An explicit place/country in `textQuery`
  // already overrides bias per Places docs — still skip a tight 2 km circle
  // so country-wide manual entry is not pulled toward FR/DE near the user.
  if (center) {
    body.locationBias = {
      circle: {
        center: {
          latitude: center.latitude,
          longitude: center.longitude,
        },
        radius,
      },
    };
  }

  if (regionCode) {
    body.regionCode = regionCode;
  }

  return postPlaces('places:searchText', body, true);
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
 * Rough ISO 3166-1 alpha-2 for Places `regionCode` ranking.
 * Names users commonly type in Manual entry.
 */
const COUNTRY_REGION_CODES: Record<string, string> = {
  austria: 'AT',
  belgium: 'BE',
  denmark: 'DK',
  france: 'FR',
  germany: 'DE',
  greece: 'GR',
  ireland: 'IE',
  italy: 'IT',
  luxembourg: 'LU',
  netherlands: 'NL',
  'the netherlands': 'NL',
  holland: 'NL',
  norway: 'NO',
  portugal: 'PT',
  spain: 'ES',
  sweden: 'SE',
  switzerland: 'CH',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  'united states': 'US',
  usa: 'US',
  'united states of america': 'US',
};

export function regionCodeForCountry(country: string): string | undefined {
  const key = country.trim().toLowerCase();
  if (!key) return undefined;
  return COUNTRY_REGION_CODES[key];
}

/** Loose country filter after Places returns (FR/DE noise with empty city). */
export function resultMatchesCountry(
  resultCountry: string,
  wantedCountry: string,
): boolean {
  const want = wantedCountry.trim().toLowerCase();
  if (!want) return true;
  const got = resultCountry.trim().toLowerCase();
  if (!got) return true;
  return got === want || got.includes(want) || want.includes(got);
}

export type SearchTextOptions = {
  /** Soft GPS bias radius in meters (ignored when `locationBias` is false). */
  radius?: number;
  /**
   * When false, omit `locationBias` so an explicit country/city in the query
   * is not overridden by a tight circle around the device.
   */
  locationBias?: boolean;
  /** ISO 3166-1 alpha-2 for ranking (Places `regionCode`). */
  regionCode?: string;
};

/**
 * Text search (Swift `RestaurantSearchService.searchText`).
 * `center` is optional when the query already names a country/city.
 */
export async function searchText(
  query: string,
  center?: LatLng | null,
  options: SearchTextOptions = {},
): Promise<RestaurantSearchResult[]> {
  const trimmed = query.trim();
  const radius = options.radius ?? DEFAULT_SEARCH_RADIUS_M;
  const useBias = options.locationBias !== false && center != null;
  const biasCenter = useBias ? center! : null;
  const regionCode = options.regionCode?.trim().toUpperCase() || undefined;

  if (!trimmed) {
    if (!center) return [];
    return searchNearby(center, radius);
  }

  const cacheQuery = `${trimmed.toLowerCase()}|bias=${useBias}|rc=${regionCode ?? ''}`;
  const results = await resolveCache(
    biasCenter,
    cacheQuery,
    () => postText(trimmed, biasCenter, radius, regionCode),
    regionCode ?? '',
  );
  return center ? withDistance(results, center) : results;
}
