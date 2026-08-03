/**
 * Places search + review draft types (Swift `RestaurantSearchResult` / `RestaurantDraft`).
 */

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RestaurantSearchResult = {
  id: string;
  name: string;
  city: string;
  country: string;
  streetAddress: string;
  phoneNumber: string;
  coordinate: LatLng;
  mapItemIdentifier: string | null;
  distanceMeters: number | null;
  /** Google Places (New) primary type, e.g. `pizza_restaurant`. */
  primaryType: string;
};

export type RestaurantDraft = {
  id: string;
  name: string;
  city: string;
  country: string;
  streetAddress: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  mapItemIdentifier: string | null;
  primaryType: string;
};

export function restaurantDraftFromResult(
  result: RestaurantSearchResult,
): RestaurantDraft {
  // Never propagate undefined ids/fields into a draft — downstream code
  // (e.g. RestaurantMatcher) calls `.trim()` / builds id-based keys on these.
  const id =
    (result.id ?? '').trim() ||
    (result.mapItemIdentifier ?? '').trim() ||
    (result.coordinate
      ? `${result.name}-${result.coordinate.latitude}-${result.coordinate.longitude}`
      : result.name);
  const mapItemIdentifier = (result.mapItemIdentifier ?? '').trim() || null;
  return {
    id,
    name: result.name,
    city: result.city ?? '',
    country: result.country ?? '',
    streetAddress: result.streetAddress ?? '',
    phoneNumber: result.phoneNumber ?? '',
    latitude: result.coordinate?.latitude ?? 0,
    longitude: result.coordinate?.longitude ?? 0,
    mapItemIdentifier,
    primaryType: result.primaryType ?? '',
  };
}

/** Swift `RestaurantPickerView.makeDraft` — manual entry without Google match. */
export function makeManualRestaurantDraft(input: {
  name: string;
  city?: string;
  country?: string;
}): RestaurantDraft | null {
  const name = input.name.trim();
  if (!name) return null;
  return {
    id: `manual-${Date.now()}`,
    name,
    city: (input.city ?? '').trim(),
    country: (input.country ?? '').trim(),
    streetAddress: '',
    phoneNumber: '',
    latitude: 0,
    longitude: 0,
    mapItemIdentifier: null,
    primaryType: '',
  };
}

export function isSameRestaurantDraft(
  a: RestaurantDraft | null | undefined,
  b:
    | (Pick<RestaurantDraft, 'name' | 'city'> & {
        id?: string;
        mapItemIdentifier?: string | null;
      })
    | null
    | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (
    a.mapItemIdentifier &&
    b.mapItemIdentifier &&
    a.mapItemIdentifier === b.mapItemIdentifier
  ) {
    return true;
  }
  return a.name === b.name && a.city === b.city;
}
