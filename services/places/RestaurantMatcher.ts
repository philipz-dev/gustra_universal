import type { Restaurant } from '@/data/types';
import { distanceMeters } from '@/services/places/RestaurantSearchService';
import type { RestaurantDraft } from '@/services/places/types';

const NAME_COORD_MAX_METERS = 150;

function norm(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * Find an existing restaurant for a draft (Swift `RestaurantMatcher.findExisting`).
 * Order: place ID → name+city → name+coords ≤150m → name+street.
 */
export function findExistingRestaurant(
  draft: RestaurantDraft,
  restaurants: Restaurant[],
): Restaurant | undefined {
  const placeId = draft.mapItemIdentifier?.trim();
  if (placeId) {
    const byPlace = restaurants.find(
      (r) => (r.mapItemIdentifier ?? '').trim() === placeId,
    );
    if (byPlace) return byPlace;
  }

  const name = norm(draft.name);
  if (!name) return undefined;

  const city = norm(draft.city);
  if (city) {
    const byNameCity = restaurants.find(
      (r) => norm(r.name) === name && norm(r.city) === city,
    );
    if (byNameCity) return byNameCity;
  }

  if (draft.latitude !== 0 || draft.longitude !== 0) {
    const byCoords = restaurants.find((r) => {
      if (norm(r.name) !== name) return false;
      if (r.latitude === 0 && r.longitude === 0) return false;
      return (
        distanceMeters(
          { latitude: draft.latitude, longitude: draft.longitude },
          { latitude: r.latitude, longitude: r.longitude },
        ) <= NAME_COORD_MAX_METERS
      );
    });
    if (byCoords) return byCoords;
  }

  const street = norm(draft.streetAddress);
  if (street) {
    return restaurants.find(
      (r) => norm(r.name) === name && norm(r.address) === street,
    );
  }

  return undefined;
}
