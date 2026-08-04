import { __mockFile, __resetMockFiles } from 'expo-file-system/legacy';

import { pruneBrokenPhotoRefs } from '@/services/photos/orphanCleanup';
import type { Restaurant, Review } from '@/data/types';

function review(id: string, restaurantId: string, photoUrls: string[]): Review {
  return {
    id,
    restaurantId,
    date: '2024-06-01',
    generalComment: '',
    criteria: [],
    photoUrls,
    reviewedBy: '',
    overallScore: 0,
    origin: 'own',
  };
}

function restaurant(id: string, name: string, photoUrl: string): Restaurant {
  return {
    id,
    name,
    city: 'Gent',
    country: 'BE',
    address: 'Straat 1',
    latitude: 51,
    longitude: 4,
    primaryType: 'restaurant',
    isFavorite: false,
    isInBucketList: false,
    thumbnailColor: '#3D6B52',
    photoUrl,
  };
}

beforeEach(() => {
  __resetMockFiles();
});

describe('pruneBrokenPhotoRefs', () => {
  it('keeps existing local photos and remote URLs', async () => {
    __mockFile('/mock/documents/Photos/a.jpg');
    __mockFile('/mock/documents/Photos/b.jpg');
    const result = await pruneBrokenPhotoRefs({
      reviews: [
        review('r1', 'x', [
          'file:///mock/documents/Photos/a.jpg',
          'https://example.com/demo.jpg',
        ]),
      ],
      restaurants: [],
    });
    expect(result.removedRefs).toBe(0);
    expect(result.reviews[0]!.photoUrls).toEqual([
      'file:///mock/documents/Photos/a.jpg',
      'https://example.com/demo.jpg',
    ]);
  });

  it('drops local refs whose file is missing, but keeps remote demo URLs', async () => {
    __mockFile('/mock/documents/Photos/keep.jpg');
    const result = await pruneBrokenPhotoRefs({
      reviews: [
        review('r1', 'x', [
          'file:///mock/documents/Photos/missing.jpg',
          'https://example.com/demo.jpg',
          'file:///mock/documents/Photos/keep.jpg',
        ]),
      ],
      restaurants: [],
    });
    expect(result.removedRefs).toBe(1);
    expect(result.reviews[0]!.photoUrls).toEqual([
      'https://example.com/demo.jpg',
      'file:///mock/documents/Photos/keep.jpg',
    ]);
  });

  it('clears a restaurant cover whose file is gone', async () => {
    const result = await pruneBrokenPhotoRefs({
      reviews: [],
      restaurants: [
        restaurant('r1', 'Het Huis', 'file:///mock/documents/Photos/gone.jpg'),
      ],
    });
    expect(result.removedRefs).toBe(1);
    expect(result.restaurants[0]!.photoUrl).toBe('');
  });
});
