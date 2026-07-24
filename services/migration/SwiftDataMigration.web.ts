import type { Restaurant, Review } from '@/data/types';

export type SwiftLegacyMigrationStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'no_store'
  | 'photos_only'
  | 'skipped_platform';

export type SwiftLegacyScan = {
  applicationSupportUri: string | null;
  storeUri: string | null;
  storeExists: boolean;
  candidateStoreUris: string[];
  photosDirUri: string | null;
  photoCount: number;
  profilePhotoExists: boolean;
  localBackupCount: number;
  tables: string[];
  migrationStatus: SwiftLegacyMigrationStatus | null;
};

export type SwiftLegacyImportResult = {
  restaurantCount: number;
  reviewCount: number;
  photosCopied: number;
  restaurants: Restaurant[];
  reviews: Review[];
  protectBackupUri: string | null;
  mode: 'overwrite' | 'merge';
};

export type AutoSwiftLegacyResult = {
  status: SwiftLegacyMigrationStatus;
  importResult: SwiftLegacyImportResult | null;
  message: string;
};

/** SwiftData recovery is iOS-only (Application Support + expo-sqlite). */
export function applicationSupportDirectory(): string | null {
  return null;
}

export async function getSwiftLegacyMigrationStatus(): Promise<SwiftLegacyMigrationStatus | null> {
  return 'skipped_platform';
}

export async function resetSwiftLegacyMigrationStatus(): Promise<void> {}

export function looksLikeSeedMockData(_reviews: Review[]): boolean {
  return true;
}

export async function scanSwiftLegacyData(): Promise<SwiftLegacyScan> {
  return {
    applicationSupportUri: null,
    storeUri: null,
    storeExists: false,
    candidateStoreUris: [],
    photosDirUri: null,
    photoCount: 0,
    profilePhotoExists: false,
    localBackupCount: 0,
    tables: [],
    migrationStatus: 'skipped_platform',
  };
}

export async function importSwiftLegacyData(): Promise<SwiftLegacyImportResult> {
  throw new Error('SwiftData recovery is only available in the iOS app.');
}

export async function ensureSwiftLegacyMigration(): Promise<AutoSwiftLegacyResult> {
  return {
    status: 'skipped_platform',
    importResult: null,
    message: 'Swift recovery is iOS-only.',
  };
}
