import {
  restaurantDraftFromResult,
  type RestaurantSearchResult,
} from '@/services/places/types';
import { findExistingRestaurant } from '@/services/places/RestaurantMatcher';
import type { Restaurant } from '@/data/types';

function restaurant(id: string, name: string, placeId?: string): Restaurant {
  return {
    id,
    name,
    city: 'Gent',
    country: 'BE',
    address: 'Straat 1',
    latitude: 51.05,
    longitude: 3.72,
    mapItemIdentifier: placeId ?? null,
    primaryType: 'restaurant',
    isFavorite: false,
    thumbnailColor: '#3D6B52',
    photoUrl: '',
  };
}

function searchResult(overrides: Partial<RestaurantSearchResult> = {}): RestaurantSearchResult {
  return {
    id: 'place_1',
    name: 'Het Huis',
    city: 'Gent',
    country: 'BE',
    streetAddress: 'Straat 1',
    phoneNumber: '',
    coordinate: { latitude: 51.05, longitude: 3.72 },
    mapItemIdentifier: 'place_1',
    distanceMeters: null,
    primaryType: 'restaurant',
    ...overrides,
  };
}

describe('restaurantDraftFromResult', () => {
  it('keeps the Google place id when present', () => {
    const draft = restaurantDraftFromResult(searchResult());
    expect(draft.id).toBe('place_1');
    expect(draft.mapItemIdentifier).toBe('place_1');
  });

  it('derives a stable id when Google omits place.id (never undefined)', () => {
    const draft = restaurantDraftFromResult(
      searchResult({ id: '', mapItemIdentifier: null }),
    );
    expect(draft.id.length).toBeGreaterThan(0);
    expect(draft.id).toContain('Het Huis');
    expect(draft.mapItemIdentifier).toBeNull();
  });

  it('never propagates undefined fields into a draft', () => {
    const draft = restaurantDraftFromResult(
      searchResult({
        id: undefined as unknown as string,
        city: undefined as unknown as string,
        country: undefined as unknown as string,
        streetAddress: undefined as unknown as string,
        phoneNumber: undefined as unknown as string,
        mapItemIdentifier: undefined as unknown as string | null,
        primaryType: undefined as unknown as string,
      }),
    );
    expect(typeof draft.id).toBe('string');
    expect(draft.city).toBe('');
    expect(draft.country).toBe('');
    expect(draft.streetAddress).toBe('');
    expect(draft.phoneNumber).toBe('');
    expect(draft.mapItemIdentifier).toBeNull();
    expect(draft.primaryType).toBe('');
  });

  it('guards a missing coordinate instead of crashing', () => {
    const draft = restaurantDraftFromResult(
      searchResult({
        coordinate: undefined as unknown as { latitude: number; longitude: number },
      }),
    );
    expect(draft.latitude).toBe(0);
    expect(draft.longitude).toBe(0);
  });
});

describe('findExistingRestaurant with missing place id', () => {
  it('matches by name+city when the draft has no mapItemIdentifier', () => {
    const existing = restaurant('r1', 'Het Huis', 'place_1');
    const draft = restaurantDraftFromResult(
      searchResult({ mapItemIdentifier: null }),
    );
    const match = findExistingRestaurant(draft, [existing]);
    expect(match?.id).toBe('r1');
  });

  it('never throws when mapItemIdentifier is undefined', () => {
    const existing = restaurant('r1', 'Anders', 'place_2');
    const draft = restaurantDraftFromResult(
      searchResult({ mapItemIdentifier: undefined as unknown as string | null }),
    );
    expect(() => findExistingRestaurant(draft, [existing])).not.toThrow();
    expect(findExistingRestaurant(draft, [existing])).toBeUndefined();
  });
});
