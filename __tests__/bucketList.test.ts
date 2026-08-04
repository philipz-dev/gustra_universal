import {
  backupRestaurantToApp,
  restaurantToBackup,
} from '@/services/backup/mapping';
import { normalizeRestaurant } from '@/data/types';
import type { Restaurant } from '@/data/types';

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'r1',
    name: 'Het Huis',
    city: 'Gent',
    country: 'BE',
    address: 'Straat 1',
    latitude: 51.05,
    longitude: 3.72,
    mapItemIdentifier: 'place_1',
    primaryType: 'restaurant',
    isFavorite: false,
    isInBucketList: false,
    thumbnailColor: '#3D6B52',
    photoUrl: '',
    ...overrides,
  };
}

describe('bucket list data compatibility', () => {
  it('normalizeRestaurant defaults isInBucketList to false for older records', () => {
    const legacy = restaurant();
    delete (legacy as Partial<Restaurant>).isInBucketList;
    const normalized = normalizeRestaurant(legacy);
    expect(normalized.isInBucketList).toBe(false);
  });

  it('normalizeRestaurant keeps an existing isInBucketList flag', () => {
    const normalized = normalizeRestaurant(restaurant({ isInBucketList: true }));
    expect(normalized.isInBucketList).toBe(true);
  });

  it('restaurantToBackup exports isInBucketList', () => {
    const backup = restaurantToBackup(restaurant({ isInBucketList: true }));
    expect(backup.isInBucketList).toBe(true);
  });

  it('backupRestaurantToApp imports isInBucketList', () => {
    const restored = backupRestaurantToApp(
      restaurantToBackup(restaurant({ isInBucketList: true })),
    );
    expect(restored.isInBucketList).toBe(true);
  });

  it('backupRestaurantToApp defaults to false when the backup omits the field', () => {
    const backup = restaurantToBackup(restaurant());
    delete (backup as Partial<typeof backup>).isInBucketList;
    expect(backupRestaurantToApp(backup).isInBucketList).toBe(false);
  });

  it('backupRestaurantToApp preserves previous bucket flag when backup omits it', () => {
    const backup = restaurantToBackup(restaurant());
    delete (backup as Partial<typeof backup>).isInBucketList;
    const restored = backupRestaurantToApp(
      backup,
      restaurant({ isInBucketList: true }),
    );
    expect(restored.isInBucketList).toBe(true);
  });
});
