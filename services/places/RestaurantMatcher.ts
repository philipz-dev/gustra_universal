import type { Restaurant } from '@/data/types';
import { recordMatcherEvent } from '@/services/debug/debugLog';
import { distanceMeters } from '@/services/places/distance';
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
    if (byPlace) {
      recordMatcherEvent({
        draftName: draft.name,
        draftPlaceId: placeId,
        restaurantsChecked: restaurants.length,
        matchedRestaurantId: byPlace.id,
        matchedVia: 'placeId',
      });
      return byPlace;
    }
  }
  const name = norm(draft.name);
  if (!name) {
    recordMatcherEvent({
      draftName: draft.name,
      draftPlaceId: placeId ?? null,
      restaurantsChecked: restaurants.length,
      matchedRestaurantId: null,
      matchedVia: null,
    });
    return undefined;
  }

  const city = norm(draft.city);
  if (city) {
    const byNameCity = restaurants.find(
      (r) => norm(r.name) === name && norm(r.city) === city,
    );
    if (byNameCity) {
      recordMatcherEvent({
        draftName: draft.name,
        draftPlaceId: placeId ?? null,
        restaurantsChecked: restaurants.length,
        matchedRestaurantId: byNameCity.id,
        matchedVia: 'nameCity',
      });
      return byNameCity;
    }
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
    if (byCoords) {
      recordMatcherEvent({
        draftName: draft.name,
        draftPlaceId: placeId ?? null,
        restaurantsChecked: restaurants.length,
        matchedRestaurantId: byCoords.id,
        matchedVia: 'coords',
      });
      return byCoords;
    }
  }

  const street = norm(draft.streetAddress);
  if (street) {
    const byStreet = restaurants.find(
      (r) => norm(r.name) === name && norm(r.address) === street,
    );
    if (byStreet) {
      recordMatcherEvent({
        draftName: draft.name,
        draftPlaceId: placeId ?? null,
        restaurantsChecked: restaurants.length,
        matchedRestaurantId: byStreet.id,
        matchedVia: 'street',
      });
      return byStreet;
    }
  }

  recordMatcherEvent({
    draftName: draft.name,
    draftPlaceId: placeId ?? null,
    restaurantsChecked: restaurants.length,
    matchedRestaurantId: null,
    matchedVia: null,
  });
  return undefined;
}
