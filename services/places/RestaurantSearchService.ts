import { GoogleAPIConfig } from '@/constants/GoogleAPIConfig';
import { recordSearchEvent } from '@/services/debug/debugLog';
import { assertGoogleApiAllowed } from '@/services/google/GoogleApiQuota';
import { incrementGoogleApi } from '@/services/google/GoogleApiTracker';
import { distanceMeters } from '@/services/places/distance';
import { resolveCache } from '@/services/places/searchCache';
import {
  DEFAULT_SEARCH_RADIUS_M,
  MAX_NEARBY_SEARCH_RADIUS_M,
} from '@/services/places/searchRadii';
import type {
  LatLng,
  RestaurantSearchResult,
} from '@/services/places/types';

/**
 * Default radius for nearby/list searches and text-search bias.
 * @deprecated Use `DEFAULT_SEARCH_RADIUS_M` from `@/services/places/searchRadii`
 *   (kept re-exported here for backward-compatible callers).
 */
export { DEFAULT_SEARCH_RADIUS_M } from '@/services/places/searchRadii';
export { MAX_NEARBY_SEARCH_RADIUS_M } from '@/services/places/searchRadii';

/** Nearby Search `includedTypes` — dining venues only (no bakery/retail food). */
const FOOD_INCLUDED_TYPES = [
  'restaurant',
  'cafe',
  'bar',
  'meal_takeaway',
] as const;

/**
 * Nearby: drop places whose *primary* business is retail food / grocery,
 * even if they also carry a dining type tag.
 */
const FOOD_EXCLUDED_PRIMARY_TYPES = [
  'bakery',
  'bagel_shop',
  'cake_shop',
  'candy_store',
  'chocolate_shop',
  'confectionery',
  'dessert_shop',
  'donut_shop',
  'pastry_shop',
  'deli',
  'ice_cream_shop',
  'sandwich_shop',
  'convenience_store',
  'supermarket',
  'grocery_store',
  'food_store',
  'market',
  'liquor_store',
] as const;

/**
 * Local allowlist for Text Search (map / manual).
 * Intentionally omits generic `food` and retail types (bakery, deli, …) —
 * those matched too many non-horeca places.
 */
const DINING_PLACE_TYPES = new Set([
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'meal_takeaway',
  'meal_delivery',
  'snack_bar',
  'fast_food_restaurant',
  'food_court',
  'pizza_restaurant',
  'wine_bar',
  'coffee_shop',
  'tea_house',
]);

const EXCLUDED_PRIMARY_TYPES = new Set<string>(FOOD_EXCLUDED_PRIMARY_TYPES);

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

/** True for restaurant / café / bar / takeaway — not bakery, deli, ice cream, grocery. */
function isDiningPlace(place: PlacesApiPlace): boolean {
  const primary = place.primaryType?.trim() ?? '';
  if (primary && EXCLUDED_PRIMARY_TYPES.has(primary)) return false;

  if (
    primary === 'restaurant' ||
    primary.endsWith('_restaurant') ||
    DINING_PLACE_TYPES.has(primary)
  ) {
    return true;
  }

  const types = place.types ?? [];
  return types.some(
    (type) => DINING_PLACE_TYPES.has(type) || type.endsWith('_restaurant'),
  );
}

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

/**
 * Haversine distance is implemented in `@/services/places/distance` and
 * re-exported here for backward-compatible callers.
 */
export { distanceMeters } from '@/services/places/distance';

/**
 * Swift `RestaurantSearchService.formattedDistance` — now device-unit aware.
 * Implementation lives in `@/services/units/distance` so pure-logic tests do
 * not have to pull in the Google Places networking stack.
 */
export { formattedDistance } from '@/services/units/distance';

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
    if (!isDiningPlace(place)) return null;
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
  // Guarantee a stable id even when Google omits `place.id` (rare) — many
  // consumers (FlatList keys, RestaurantMatcher, review drafts) assume one.
  const id = (place.id ?? '').trim() || `${name}-${latitude}-${longitude}`;

  return {
    id,
    name,
    city,
    country,
    streetAddress: place.formattedAddress ?? '',
    phoneNumber,
    coordinate: { latitude, longitude },
    mapItemIdentifier: place.id?.trim() || null,
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
  await assertGoogleApiAllowed('places');

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

  const rawPlaces = data.places ?? [];
  const results = rawPlaces
    .map((place) => makeResult(place, restrictToFood))
    .filter((item): item is RestaurantSearchResult => item != null);
  return results;
}

/**
 * Record a search summary for the dev debug log. Kept separate from
 * `postPlaces` so callers (nearby vs text) can attach their real center/radius
 * and mode after `withDistance` has run.
 */
function recordSearchSummary(
  mode: 'nearby' | 'text' | 'text-no-center',
  center: LatLng | null,
  radius: number,
  results: RestaurantSearchResult[],
): void {
  recordSearchEvent({
    center,
    radius,
    mode,
    rawPlaces: results.length,
    results: results.length,
    noPlaceId: results.filter((r) => r.mapItemIdentifier == null).length,
    samples: results.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      distanceMeters: r.distanceMeters,
    })),
  });
}

async function postNearby(
  center: LatLng,
  radius: number,
): Promise<RestaurantSearchResult[]> {
  return postPlaces(
    'places:searchNearby',
    {
      includedTypes: [...FOOD_INCLUDED_TYPES],
      excludedPrimaryTypes: [...FOOD_EXCLUDED_PRIMARY_TYPES],
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
    },
    true,
  );
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
  await assertGoogleApiAllowed('places');

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
  const results = await resolveCache(center, '__nearby__', radius, () =>
    postNearby(center, radius),
  );
  const withIds = withDistance(results, center);
  recordSearchSummary('nearby', center, radius, withIds);
  return withIds;
}

/**
 * Rough ISO 3166-1 alpha-2 for Places `regionCode` ranking.
 * Names users commonly type in Manual entry (folded: no accents).
 */
const COUNTRY_REGION_CODES: Record<string, string> = {
  austria: 'AT',
  osterreich: 'AT',
  oesterreich: 'AT',
  belgium: 'BE',
  belgie: 'BE',
  belgique: 'BE',
  belgien: 'BE',
  belgio: 'BE',
  denmark: 'DK',
  danemark: 'DK',
  danmark: 'DK',
  france: 'FR',
  frankrijk: 'FR',
  frankreich: 'FR',
  francia: 'FR',
  germany: 'DE',
  deutschland: 'DE',
  duitsland: 'DE',
  allemagne: 'DE',
  germania: 'DE',
  greece: 'GR',
  griekenland: 'GR',
  ireland: 'IE',
  italy: 'IT',
  italie: 'IT',
  italien: 'IT',
  italia: 'IT',
  luxembourg: 'LU',
  luxemburg: 'LU',
  netherlands: 'NL',
  'the netherlands': 'NL',
  holland: 'NL',
  nederland: 'NL',
  paysbas: 'NL',
  'pays-bas': 'NL',
  norway: 'NO',
  portugal: 'PT',
  spain: 'ES',
  spanje: 'ES',
  spanien: 'ES',
  espagne: 'ES',
  espana: 'ES',
  sweden: 'SE',
  switzerland: 'CH',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  'united states': 'US',
  usa: 'US',
  'united states of america': 'US',
};

/** Lowercase + strip diacritics so “België” and “Belgie” match the same key. */
export function foldCountryKey(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function regionCodeForCountry(country: string): string | undefined {
  const key = foldCountryKey(country);
  if (!key) return undefined;
  return COUNTRY_REGION_CODES[key];
}

/** Loose country filter after Places returns (FR/DE noise with empty city). */
export function resultMatchesCountry(
  resultCountry: string,
  wantedCountry: string,
): boolean {
  const want = foldCountryKey(wantedCountry);
  if (!want) return true;
  const got = foldCountryKey(resultCountry);
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
    radius,
    () => postText(trimmed, biasCenter, radius, regionCode),
    regionCode ?? '',
  );
  const withIds = results.map((result) =>
    result.id.trim()
      ? result
      : {
          ...result,
          id:
            (result.mapItemIdentifier ?? '').trim() ||
            `${result.name}-${result.coordinate.latitude}-${result.coordinate.longitude}`,
        },
  );
  const final = center ? withDistance(withIds, center) : withIds;
  recordSearchSummary(
    center ? 'text' : 'text-no-center',
    center ?? null,
    radius,
    final,
  );
  return final;
}
