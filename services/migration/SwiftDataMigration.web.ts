import type { Restaurant, Review } from '@/data/types';

export type SwiftLegacyScan = {
  applicationSupportUri: string | null;
  storeUri: string | null;
  storeExists: boolean;
  photosDirUri: string | null;
  photoCount: number;
  profilePhotoExists: boolean;
  localBackupCount: number;
  tables: string[];
};

export type SwiftLegacyImportResult = {
  restaurantCount: number;
  reviewCount: number;
  photosCopied: number;
  restaurants: Restaurant[];
  reviews: Review[];
};

/** SwiftData recovery is iOS-only (Application Support + expo-sqlite). */
export function applicationSupportDirectory(): string | null {
  return null;
}

export async function scanSwiftLegacyData(): Promise<SwiftLegacyScan> {
  return {
    applicationSupportUri: null,
    storeUri: null,
    storeExists: false,
    photosDirUri: null,
    photoCount: 0,
    profilePhotoExists: false,
    localBackupCount: 0,
    tables: [],
  };
}

export async function importSwiftLegacyData(): Promise<SwiftLegacyImportResult> {
  throw new Error('SwiftData recovery is only available in the iOS app.');
}
