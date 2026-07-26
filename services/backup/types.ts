/** Swift-compatible `.gustra` payload (`BackupPayload`). */

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_FILE_EXTENSION = 'gustra';

/** Seconds between Unix epoch and Apple reference date (2001-01-01). */
export const APPLE_REFERENCE_DATE_OFFSET = 978307200;

export type RestaurantBackup = {
  id: string;
  name: string;
  city: string;
  country: string;
  streetAddress?: string | null;
  phoneNumber?: string | null;
  latitude: number;
  longitude: number;
  mapItemIdentifier?: string | null;
  isFavorite?: boolean | null;
  primaryType?: string | null;
};

export type ReviewBackup = {
  id: string;
  /** Apple reference-date seconds (Swift `Date` JSON). */
  date: number;
  restaurantID?: string | null;
  foodRating: number;
  drinksRating: number;
  serviceRating: number;
  settingRating: number;
  valueRating: number;
  customRating?: number | null;
  customCriterionScoresJSON?: string | null;
  foodComment: string;
  drinksComment: string;
  serviceComment: string;
  settingComment: string;
  valueComment: string;
  customComment?: string | null;
  generalComment?: string | null;
  searchableText: string;
  photoPaths: string[];
  isNeverAgain: boolean;
  reviewedBy?: string | null;
  /** Stable author UUID (Expo extension — ignored by older Swift). */
  reviewedById?: string | null;
  reviewedByPhotoPath?: string | null;
  origin?: string | null;
  /**
   * Expo extension: JSON string of WineLabelFiche (ignored by older Swift).
   * Label photo filename should also appear in photoPaths / photoFiles.
   */
  wineLabelJSON?: string | null;
  /**
   * Expo extension: original shared review UUID (for re-import upsert).
   * Ignored by older Swift / Expo.
   */
  sourceReviewId?: string | null;
};

/** App settings beyond Swift schema v1 — ignored by Swift decoder. */
export type ReviewerProfileBackup = {
  name: string;
  /** Key in `photoFiles`, when present. */
  photoFileName?: string | null;
  /** Stable author UUID used when sharing (Expo extension). */
  authorId?: string | null;
};

export type CustomCriterionBackup = {
  id: string;
  name: string;
  isEnabled: boolean;
};

export type CriteriaSettingsBackup = {
  disabledStandardIds: string[];
  customCriteria: CustomCriterionBackup[];
};

export type BackupPayload = {
  schemaVersion: number;
  appVersion: string;
  /** Apple reference-date seconds. */
  exportedAt: number;
  restaurants: RestaurantBackup[];
  reviews: ReviewBackup[];
  /** filename → base64 JPEG bytes */
  photoFiles: Record<string, string>;
  /** Expo extension — absent in Swift backups. */
  reviewerProfile?: ReviewerProfileBackup | null;
  /** Expo extension — absent in Swift backups. */
  criteriaSettings?: CriteriaSettingsBackup | null;
};

/** Stable key for the profile photo inside `photoFiles`. */
export const REVIEWER_PHOTO_BACKUP_KEY = 'reviewer.jpg';

export type BackupImportMode = 'merge' | 'overwrite';

export type LocalBackupFile = {
  uri: string;
  name: string;
  modified: number;
  byteCount: number;
};

export function toAppleRefDate(input: Date | string | number): number {
  const ms =
    typeof input === 'number'
      ? input
      : typeof input === 'string'
        ? +new Date(input)
        : input.getTime();
  return ms / 1000 - APPLE_REFERENCE_DATE_OFFSET;
}

export function fromAppleRefDate(ref: number): string {
  return new Date((ref + APPLE_REFERENCE_DATE_OFFSET) * 1000).toISOString();
}
