import type { Restaurant } from '@/data/types';
import type { RestaurantDraft } from '@/services/places/types';

/** Swift `RestaurantDraft(from: Restaurant)`. */
export function restaurantDraftFromRestaurant(
  restaurant: Restaurant,
): RestaurantDraft {
  return {
    id: restaurant.id,
    name: restaurant.name,
    city: restaurant.city,
    country: restaurant.country,
    streetAddress: restaurant.address,
    phoneNumber: restaurant.phone ?? '',
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    mapItemIdentifier: restaurant.mapItemIdentifier ?? null,
    primaryType: restaurant.primaryType,
  };
}
