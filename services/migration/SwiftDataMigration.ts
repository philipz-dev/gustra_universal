import * as FileSystem from 'expo-file-system/legacy';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { Restaurant, Review } from '@/data/types';
import { applyBackupPayload } from '@/services/backup/BackupService';
import {
  APPLE_REFERENCE_DATE_OFFSET,
  type BackupPayload,
  type RestaurantBackup,
  type ReviewBackup,
} from '@/services/backup/types';
import { ensurePhotosDirectory } from '@/services/backup/photos';

export type SwiftLegacyScan = {
  applicationSupportUri: string | null;
  storeUri: string | null;
  storeExists: boolean;
  photosDirUri: string | null;
  photoCount: number;
  profilePhotoExists: boolean;
  localBackupCount: number;
  /** Tables found in the store (for diagnostics). */
  tables: string[];
};

export type SwiftLegacyImportResult = {
  restaurantCount: number;
  reviewCount: number;
  photosCopied: number;
  restaurants: Restaurant[];
  reviews: Review[];
};

function trimSlash(uri: string): string {
  return uri.replace(/\/?$/, '');
}

/** Documents/ → Library/Application Support/ (same app container). */
export function applicationSupportDirectory(): string | null {
  const docs = FileSystem.documentDirectory;
  if (!docs) return null;
  const base = trimSlash(docs);
  if (!base.endsWith('/Documents')) return null;
  return `${base.slice(0, -'/Documents'.length)}/Library/Application Support/`;
}

async function dirExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && Boolean(info.isDirectory);
  } catch {
    return false;
  }
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

async function listFiles(uri: string): Promise<string[]> {
  try {
    if (!(await dirExists(uri))) return [];
    return await FileSystem.readDirectoryAsync(uri);
  } catch {
    return [];
  }
}

/**
 * Probe the sandbox for leftover Swift Gustra files
 * (`default.store`, Application Support Photos/, Documents/Backups/).
 */
export async function scanSwiftLegacyData(): Promise<SwiftLegacyScan> {
  const support = applicationSupportDirectory();
  const docs = FileSystem.documentDirectory;
  const empty: SwiftLegacyScan = {
    applicationSupportUri: support,
    storeUri: null,
    storeExists: false,
    photosDirUri: null,
    photoCount: 0,
    profilePhotoExists: false,
    localBackupCount: 0,
    tables: [],
  };
  if (!support) return empty;

  const storeUri = `${support}default.store`;
  const photosDirUri = `${support}Photos/`;
  const profileUri = `${support}Profile/reviewer.jpg`;
  const storeExists = await fileExists(storeUri);
  const photoNames = (await listFiles(photosDirUri)).filter((n) =>
    /\.(jpe?g|png|heic)$/i.test(n),
  );
  let localBackupCount = 0;
  if (docs) {
    const backups = await listFiles(`${docs}Backups/`);
    localBackupCount = backups.filter((n) =>
      n.toLowerCase().endsWith('.gustra'),
    ).length;
  }

  let tables: string[] = [];
  if (storeExists) {
    try {
      const db = await openStoreCopy(storeUri);
      try {
        tables = await listUserTables(db);
      } finally {
        await db.closeAsync();
      }
    } catch {
      tables = [];
    }
  }

  return {
    applicationSupportUri: support,
    storeUri: storeExists ? storeUri : null,
    storeExists,
    photosDirUri: (await dirExists(photosDirUri)) ? photosDirUri : null,
    photoCount: photoNames.length,
    profilePhotoExists: await fileExists(profileUri),
    localBackupCount,
    tables,
  };
}

async function openStoreCopy(storeUri: string): Promise<SQLiteDatabase> {
  const cache = FileSystem.cacheDirectory;
  if (!cache) throw new Error('Cache directory unavailable');
  const dirUri = `${cache}swift-migrate/`;
  const info = await FileSystem.getInfoAsync(dirUri);
  if (info.exists) {
    await FileSystem.deleteAsync(dirUri, { idempotent: true });
  }
  await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });

  const destUri = `${dirUri}default.store`;
  await FileSystem.copyAsync({ from: storeUri, to: destUri });
  for (const suffix of ['-wal', '-shm']) {
    const side = `${storeUri}${suffix}`;
    if (await fileExists(side)) {
      await FileSystem.copyAsync({ from: side, to: `${destUri}${suffix}` });
    }
  }

  const directory = trimSlash(dirUri).replace(/^file:\/\//, '');
  return openDatabaseAsync('default.store', {}, directory);
}

async function listUserTables(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  return rows.map((r) => r.name);
}

function pickTable(tables: string[], candidates: string[]): string | null {
  const upper = new Map(tables.map((t) => [t.toUpperCase(), t]));
  for (const c of candidates) {
    const hit = upper.get(c.toUpperCase());
    if (hit) return hit;
  }
  return null;
}

function rowVal(row: Record<string, unknown>, ...keys: string[]): unknown {
  const map = new Map(
    Object.keys(row).map((k) => [k.toUpperCase().replace(/^Z/, ''), row[k]]),
  );
  // Also index raw keys uppercased
  for (const [k, v] of Object.entries(row)) {
    map.set(k.toUpperCase(), v);
  }
  for (const key of keys) {
    const variants = [
      key.toUpperCase(),
      `Z${key.toUpperCase()}`,
      key.toUpperCase().replace(/^Z/, ''),
    ];
    for (const v of variants) {
      if (map.has(v) && map.get(v) != null) return map.get(v);
    }
  }
  return undefined;
}

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(value);
    } catch {
      return '';
    }
  }
  return '';
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return false;
}

/** SwiftData / Core Data often store UUID as 16-byte blob. */
function asUuid(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
    ) {
      return t.toLowerCase();
    }
  }
  let bytes: Uint8Array | null = null;
  if (value instanceof Uint8Array && value.length === 16) bytes = value;
  else if (Array.isArray(value) && value.length === 16) {
    bytes = Uint8Array.from(value as number[]);
  } else if (typeof value === 'object' && value && 'length' in value) {
    try {
      const arr = value as ArrayLike<number>;
      if (arr.length === 16) bytes = Uint8Array.from(Array.from(arr));
    } catch {
      bytes = null;
    }
  }
  if (!bytes) return null;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Swift `Date` in Core Data / SwiftData is usually seconds since
 * 2001-01-01 (Apple reference date). Convert to Apple-ref for BackupPayload.
 */
function asAppleRefDate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Date.now() / 1000 - APPLE_REFERENCE_DATE_OFFSET;
  }
  // Heuristic: Unix seconds (~1.7e9) vs Apple ref (~7e8 in 2024)
  if (value > 1_000_000_000_000) {
    // ms unix
    return value / 1000 - APPLE_REFERENCE_DATE_OFFSET;
  }
  if (value > 1_000_000_000) {
    // unix seconds
    return value - APPLE_REFERENCE_DATE_OFFSET;
  }
  return value;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => asString(v)).filter(Boolean);
      }
    } catch {
      // fall through
    }
    return t.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  if (value instanceof Uint8Array || (value && typeof value === 'object')) {
    try {
      const bytes =
        value instanceof Uint8Array
          ? value
          : Uint8Array.from(Array.from(value as ArrayLike<number>));
      const text = new TextDecoder().decode(bytes);
      if (text.startsWith('[') || text.startsWith('{')) {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((v) => asString(v)).filter(Boolean);
        }
      }
      // NSKeyedArchiver / binary blobs often still contain bare filenames.
      const latin = new TextDecoder('latin1').decode(bytes);
      const found = latin.match(/[A-Za-z0-9_-]+\.jpe?g/gi);
      if (found?.length) return [...new Set(found)];
    } catch {
      // ignore
    }
  }
  return [];
}

async function copySwiftPhotosToDocuments(
  supportPhotosDir: string | null,
): Promise<number> {
  if (!supportPhotosDir) return 0;
  const names = (await listFiles(supportPhotosDir)).filter((n) =>
    /\.(jpe?g|png|heic)$/i.test(n),
  );
  if (names.length === 0) return 0;
  const destDir = await ensurePhotosDirectory();
  let copied = 0;
  for (const name of names) {
    const from = `${trimSlash(supportPhotosDir)}/${name}`;
    const to = `${destDir}${name}`;
    try {
      if (await fileExists(to)) {
        copied += 1;
        continue;
      }
      await FileSystem.copyAsync({ from, to });
      copied += 1;
    } catch {
      // skip unreadable
    }
  }
  return copied;
}

async function copyProfilePhotoIfPresent(support: string): Promise<void> {
  const from = `${support}Profile/reviewer.jpg`;
  if (!(await fileExists(from))) return;
  const docs = FileSystem.documentDirectory;
  if (!docs) return;
  const dir = `${docs}Profile/`;
  if (!(await dirExists(dir))) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const to = `${dir}reviewer.jpg`;
  try {
    await FileSystem.copyAsync({ from, to });
  } catch {
    // ignore
  }
}

/**
 * Read SwiftData `default.store` and convert to Expo restaurants/reviews.
 * Also copies Application Support Photos/ → Documents/Photos/.
 */
export async function importSwiftLegacyData(): Promise<SwiftLegacyImportResult> {
  const scan = await scanSwiftLegacyData();
  if (!scan.storeExists || !scan.storeUri) {
    throw new Error(
      'No previous Gustra database found (Application Support/default.store).',
    );
  }

  const photosCopied = await copySwiftPhotosToDocuments(scan.photosDirUri);
  if (scan.applicationSupportUri) {
    await copyProfilePhotoIfPresent(scan.applicationSupportUri);
  }

  const db = await openStoreCopy(scan.storeUri);
  try {
    const tables = await listUserTables(db);
    const restaurantTable = pickTable(tables, [
      'ZRESTAURANT',
      'Restaurant',
      'RESTAURANT',
    ]);
    const reviewTable = pickTable(tables, ['ZREVIEW', 'Review', 'REVIEW']);
    if (!restaurantTable || !reviewTable) {
      throw new Error(
        `Swift database found but tables missing (have: ${tables.join(', ') || 'none'}).`,
      );
    }

    const restaurantRows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM "${restaurantTable}"`,
    );
    const reviewRows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM "${reviewTable}"`,
    );

    // Map Core Data Z_PK → UUID for relationship joins
    const pkToUuid = new Map<number, string>();
    const restaurantsBackup: RestaurantBackup[] = [];

    for (const row of restaurantRows) {
      const id =
        asUuid(rowVal(row, 'ID', 'UUID')) ??
        asUuid(rowVal(row, 'id')) ??
        cryptoRandomUuid();
      const pk = asNumber(rowVal(row, 'PK', '_PK'));
      if (pk) pkToUuid.set(pk, id);

      restaurantsBackup.push({
        id,
        name: asString(rowVal(row, 'NAME', 'name')) || 'Restaurant',
        city: asString(rowVal(row, 'CITY', 'city')),
        country: asString(rowVal(row, 'COUNTRY', 'country')),
        streetAddress:
          asString(rowVal(row, 'STREETADDRESS', 'streetAddress')) || null,
        phoneNumber:
          asString(rowVal(row, 'PHONENUMBER', 'phoneNumber')) || null,
        latitude: asNumber(rowVal(row, 'LATITUDE', 'latitude')),
        longitude: asNumber(rowVal(row, 'LONGITUDE', 'longitude')),
        mapItemIdentifier:
          asString(rowVal(row, 'MAPITEMIDENTIFIER', 'mapItemIdentifier')) ||
          null,
        isFavorite: asBool(rowVal(row, 'ISFAVORITE', 'isFavorite')),
        primaryType:
          asString(rowVal(row, 'PRIMARYTYPE', 'primaryType')) || null,
      });
    }

    const reviewsBackup: ReviewBackup[] = [];
    for (const row of reviewRows) {
      const id =
        asUuid(rowVal(row, 'ID', 'UUID')) ??
        asUuid(rowVal(row, 'id')) ??
        cryptoRandomUuid();

      let restaurantID: string | null = null;
      const relPk = asNumber(rowVal(row, 'RESTAURANT', 'restaurant'));
      if (relPk && pkToUuid.has(relPk)) {
        restaurantID = pkToUuid.get(relPk) ?? null;
      } else {
        restaurantID =
          asUuid(rowVal(row, 'RESTAURANTID', 'restaurantID')) ?? null;
      }

      const photoPaths = asStringArray(
        rowVal(row, 'PHOTOPATHS', 'photoPaths'),
      ).map((p) => p.split('/').filter(Boolean).pop() ?? p);

      reviewsBackup.push({
        id,
        date: asAppleRefDate(rowVal(row, 'DATE', 'date')),
        restaurantID,
        foodRating: asNumber(rowVal(row, 'FOODRATING', 'foodRating')),
        drinksRating: asNumber(rowVal(row, 'DRINKSRATING', 'drinksRating')),
        serviceRating: asNumber(rowVal(row, 'SERVICERATING', 'serviceRating')),
        settingRating: asNumber(rowVal(row, 'SETTINGRATING', 'settingRating')),
        valueRating: asNumber(rowVal(row, 'VALUERATING', 'valueRating')),
        customRating: asNumber(rowVal(row, 'CUSTOMRATING', 'customRating')),
        customCriterionScoresJSON:
          asString(
            rowVal(row, 'CUSTOMCRITERIONSCORESJSON', 'customCriterionScoresJSON'),
          ) || null,
        foodComment: asString(rowVal(row, 'FOODCOMMENT', 'foodComment')),
        drinksComment: asString(rowVal(row, 'DRINKSCOMMENT', 'drinksComment')),
        serviceComment: asString(
          rowVal(row, 'SERVICECOMMENT', 'serviceComment'),
        ),
        settingComment: asString(
          rowVal(row, 'SETTINGCOMMENT', 'settingComment'),
        ),
        valueComment: asString(rowVal(row, 'VALUECOMMENT', 'valueComment')),
        customComment:
          asString(rowVal(row, 'CUSTOMCOMMENT', 'customComment')) || null,
        generalComment:
          asString(rowVal(row, 'GENERALCOMMENT', 'generalComment')) || null,
        searchableText: asString(
          rowVal(row, 'SEARCHABLETEXT', 'searchableText'),
        ),
        photoPaths,
        isNeverAgain: asBool(rowVal(row, 'ISNEVERAGAIN', 'isNeverAgain')),
        reviewedBy: asString(rowVal(row, 'REVIEWEDBY', 'reviewedBy')) || null,
        reviewedByPhotoPath:
          asString(
            rowVal(row, 'REVIEWEDBYPHOTOPATH', 'reviewedByPhotoPath'),
          ) || null,
        origin: asString(rowVal(row, 'ORIGINRAW', 'originRaw', 'origin')) || null,
      });
    }

    if (restaurantsBackup.length === 0 && reviewsBackup.length === 0) {
      throw new Error(
        'Previous database opened, but no restaurants or reviews were found.',
      );
    }

    const payload: BackupPayload = {
      schemaVersion: 1,
      appVersion: 'swift-migrate',
      exportedAt: Date.now() / 1000 - APPLE_REFERENCE_DATE_OFFSET,
      restaurants: restaurantsBackup,
      reviews: reviewsBackup,
      photoFiles: {},
    };

    // Photos already on disk under Documents/Photos; payload uses filenames only.
    const next = await applyBackupPayload({
      payload,
      mode: 'overwrite',
      currentRestaurants: [],
      currentReviews: [],
    });

    return {
      restaurantCount: next.restaurants.length,
      reviewCount: next.reviews.length,
      photosCopied,
      restaurants: next.restaurants,
      reviews: next.reviews,
    };
  } finally {
    await db.closeAsync();
  }
}

function cryptoRandomUuid(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
