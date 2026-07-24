import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { Restaurant, Review } from '@/data/types';
import { buildPayloadFromApp } from '@/services/backup/mapping';
import {
  collectLocalPhotoFiles,
  ensurePhotosDirectory,
} from '@/services/backup/photos';
import {
  APPLE_REFERENCE_DATE_OFFSET,
  type BackupPayload,
  type RestaurantBackup,
  type ReviewBackup,
} from '@/services/backup/types';
import { applyBackupPayload, pruneAutoProtectBackups } from '@/services/backup/BackupService';

const MIGRATION_STATUS_KEY = 'gustra.swiftLegacy.migrationStatus.v1';

export type SwiftLegacyMigrationStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'no_store'
  | 'photos_only'
  | 'skipped_platform';

export type SwiftLegacyScan = {
  applicationSupportUri: string | null;
  /** Best candidate store URI (validated or preferred path). */
  storeUri: string | null;
  storeExists: boolean;
  /** All candidate DB files discovered under the sandbox. */
  candidateStoreUris: string[];
  photosDirUri: string | null;
  photoCount: number;
  profilePhotoExists: boolean;
  localBackupCount: number;
  /** Tables found in the chosen store (for diagnostics). */
  tables: string[];
  migrationStatus: SwiftLegacyMigrationStatus | null;
};

export type SwiftLegacyImportResult = {
  restaurantCount: number;
  reviewCount: number;
  photosCopied: number;
  restaurants: Restaurant[];
  reviews: Review[];
  /** Absolute URI of AutoProtect snapshot written before overwrite (if any). */
  protectBackupUri: string | null;
  mode: 'overwrite' | 'merge';
};

export type AutoSwiftLegacyResult = {
  status: SwiftLegacyMigrationStatus;
  importResult: SwiftLegacyImportResult | null;
  message: string;
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

function libraryDirectory(): string | null {
  const docs = FileSystem.documentDirectory;
  if (!docs) return null;
  const base = trimSlash(docs);
  if (!base.endsWith('/Documents')) return null;
  return `${base.slice(0, -'/Documents'.length)}/Library/`;
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

function isDbCandidateName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith('-wal') || lower.endsWith('-shm')) return false;
  return (
    lower.endsWith('.store') ||
    lower.endsWith('.sqlite') ||
    lower.endsWith('.sqlite3') ||
    lower.endsWith('.db')
  );
}

/**
 * Recursively find database-like files. Never deletes anything.
 * Depth-capped to keep scans cheap on large sandboxes.
 */
async function findDatabaseCandidates(
  rootUri: string,
  maxDepth = 5,
): Promise<string[]> {
  const found: string[] = [];
  const visit = async (uri: string, depth: number) => {
    if (depth > maxDepth) return;
    const names = await listFiles(uri);
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const child = `${trimSlash(uri)}/${name}`;
      try {
        const info = await FileSystem.getInfoAsync(child);
        if (!info.exists) continue;
        if (info.isDirectory) {
          // Skip bulky / irrelevant trees.
          if (/^(Caches|tmp|WebKit|SplashBoard|Preferences)$/i.test(name)) {
            continue;
          }
          await visit(child, depth + 1);
        } else if (isDbCandidateName(name)) {
          found.push(child);
        }
      } catch {
        // ignore unreadable entries
      }
    }
  };
  if (await dirExists(rootUri)) {
    await visit(rootUri, 0);
  }
  return found;
}

function scoreStoreCandidate(uri: string): number {
  const lower = uri.toLowerCase();
  let score = 0;
  if (lower.endsWith('/default.store')) score += 100;
  if (lower.includes('/application%20support/') || lower.includes('/Application Support/')) {
    score += 40;
  }
  if (lower.endsWith('.store')) score += 20;
  if (lower.includes('gustra')) score += 10;
  return score;
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

function looksLikeGustraStore(tables: string[]): boolean {
  return Boolean(
    pickTable(tables, ['ZRESTAURANT', 'Restaurant', 'RESTAURANT']) &&
      pickTable(tables, ['ZREVIEW', 'Review', 'REVIEW']),
  );
}

/**
 * Pick the best readable Gustra SwiftData/Core Data store among candidates.
 * Prefers validated Review+Restaurant tables; never modifies source files.
 */
async function resolveBestStore(
  candidates: string[],
): Promise<{ uri: string; tables: string[] } | null> {
  const ordered = [...candidates].sort(
    (a, b) => scoreStoreCandidate(b) - scoreStoreCandidate(a),
  );
  let fallback: { uri: string; tables: string[] } | null = null;
  for (const uri of ordered) {
    try {
      const db = await openStoreCopy(uri);
      try {
        const tables = await listUserTables(db);
        if (looksLikeGustraStore(tables)) {
          return { uri, tables };
        }
        if (!fallback && tables.length > 0) {
          fallback = { uri, tables };
        }
      } finally {
        await db.closeAsync();
      }
    } catch {
      // try next candidate
    }
  }
  return fallback;
}

export async function getSwiftLegacyMigrationStatus(): Promise<SwiftLegacyMigrationStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(MIGRATION_STATUS_KEY);
    if (!raw) return null;
    return raw as SwiftLegacyMigrationStatus;
  } catch {
    return null;
  }
}

async function setSwiftLegacyMigrationStatus(
  status: SwiftLegacyMigrationStatus,
): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_STATUS_KEY, status);
}

/** Allow Settings “Recover” to force another attempt. */
export async function resetSwiftLegacyMigrationStatus(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_STATUS_KEY);
}

/**
 * Probe the sandbox for leftover Swift Gustra files.
 * Broad search: Application Support, Documents, Library — any *.store/*.sqlite.
 */
export async function scanSwiftLegacyData(): Promise<SwiftLegacyScan> {
  const support = applicationSupportDirectory();
  const docs = FileSystem.documentDirectory;
  const library = libraryDirectory();
  const migrationStatus = await getSwiftLegacyMigrationStatus();
  const empty: SwiftLegacyScan = {
    applicationSupportUri: support,
    storeUri: null,
    storeExists: false,
    candidateStoreUris: [],
    photosDirUri: null,
    photoCount: 0,
    profilePhotoExists: false,
    localBackupCount: 0,
    tables: [],
    migrationStatus,
  };
  if (!support && !docs) return empty;

  const photosDirUri = support ? `${support}Photos/` : null;
  const profileUri = support ? `${support}Profile/reviewer.jpg` : null;
  const photoNames = photosDirUri
    ? (await listFiles(photosDirUri)).filter((n) =>
        /\.(jpe?g|png|heic)$/i.test(n),
      )
    : [];

  let localBackupCount = 0;
  if (docs) {
    const backups = await listFiles(`${docs}Backups/`);
    localBackupCount = backups.filter(
      (n) =>
        n.toLowerCase().endsWith('.gustra') ||
        n.toLowerCase().includes('autoprotect'),
    ).length;
  }

  const roots = [support, docs, library].filter(Boolean) as string[];
  const candidateSet = new Set<string>();
  for (const root of roots) {
    for (const uri of await findDatabaseCandidates(root)) {
      candidateSet.add(uri);
    }
  }
  // Always probe the classic SwiftData path first even if listing missed it.
  if (support) {
    const classic = `${support}default.store`;
    if (await fileExists(classic)) candidateSet.add(classic);
  }

  const candidates = [...candidateSet];
  const best = candidates.length > 0 ? await resolveBestStore(candidates) : null;

  return {
    applicationSupportUri: support,
    storeUri: best?.uri ?? null,
    storeExists: Boolean(best?.uri),
    candidateStoreUris: candidates,
    photosDirUri: photosDirUri && (await dirExists(photosDirUri)) ? photosDirUri : null,
    photoCount: photoNames.length,
    profilePhotoExists: profileUri ? await fileExists(profileUri) : false,
    localBackupCount,
    tables: best?.tables ?? [],
    migrationStatus,
  };
}

function rowVal(row: Record<string, unknown>, ...keys: string[]): unknown {
  const map = new Map(
    Object.keys(row).map((k) => [k.toUpperCase().replace(/^Z/, ''), row[k]]),
  );
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

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
  }
  return false;
}

function asUuid(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
    ) {
      return t.toLowerCase();
    }
  }
  if (value instanceof Uint8Array && value.length === 16) {
    const hex = [...value].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return null;
}

function asAppleRefDate(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Already unix? Heuristic: Apple ref dates are smaller than unix for recent years.
    if (value > 1e12) return value / 1000 - APPLE_REFERENCE_DATE_OFFSET;
    if (value > 1e9) return value - APPLE_REFERENCE_DATE_OFFSET;
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed / 1000 - APPLE_REFERENCE_DATE_OFFSET;
    }
  }
  return Date.now() / 1000 - APPLE_REFERENCE_DATE_OFFSET;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => asString(v)).filter(Boolean);
      }
    } catch {
      // fall through
    }
    if (value.includes(',')) {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [value.trim()];
  }
  if (value instanceof Uint8Array) {
    try {
      const latin = new TextDecoder('latin1').decode(value);
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
      // skip unreadable — never delete source
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
    if (!(await fileExists(to))) {
      await FileSystem.copyAsync({ from, to });
    }
  } catch {
    // ignore — never delete source
  }
}

/** True when the Expo store still looks like the shipping seed (safe to replace). */
export function looksLikeSeedMockData(reviews: Review[]): boolean {
  if (reviews.length === 0) return true;
  return reviews.every((r) =>
    (r.photoUrls ?? []).every(
      (u) =>
        typeof u === 'string' &&
        (/^https?:\/\//i.test(u) || u.includes('unsplash')),
    ),
  );
}

async function writeAutoProtectSnapshot(args: {
  restaurants: Restaurant[];
  reviews: Review[];
}): Promise<string | null> {
  if (args.reviews.length === 0 && args.restaurants.length === 0) return null;
  const docs = FileSystem.documentDirectory;
  if (!docs) return null;
  const dir = `${docs}Backups/`;
  if (!(await dirExists(dir))) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uri = `${dir}AutoProtect-before-swift-migrate-${stamp}.json`;
  try {
    const photoFiles = await collectLocalPhotoFiles(
      args.reviews.flatMap((r) => r.photoUrls ?? []),
    );
    const payload = buildPayloadFromApp({
      restaurants: args.restaurants,
      reviews: args.reviews,
      appVersion: 'auto-protect',
      photoFiles,
    });
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await pruneAutoProtectBackups();
    return uri;
  } catch {
    return null;
  }
}

async function readSwiftPackageFromStore(
  storeUri: string,
): Promise<{ restaurants: RestaurantBackup[]; reviews: ReviewBackup[] }> {
  const db = await openStoreCopy(storeUri);
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

    return { restaurants: restaurantsBackup, reviews: reviewsBackup };
  } finally {
    await db.closeAsync();
  }
}

/**
 * Read SwiftData store + copy Application Support Photos → Documents/Photos.
 * Never deletes Swift source files. Snapshots current Expo data first when present.
 */
export async function importSwiftLegacyData(args?: {
  currentRestaurants?: Restaurant[];
  currentReviews?: Review[];
  /** Force re-scan even if status was completed. */
  force?: boolean;
}): Promise<SwiftLegacyImportResult> {
  const currentRestaurants = args?.currentRestaurants ?? [];
  const currentReviews = args?.currentReviews ?? [];
  const scan = await scanSwiftLegacyData();

  // Always try to preserve orphaned Swift photos into Documents/Photos.
  const photosCopied = await copySwiftPhotosToDocuments(scan.photosDirUri);
  if (scan.applicationSupportUri) {
    await copyProfilePhotoIfPresent(scan.applicationSupportUri);
  }

  if (!scan.storeExists || !scan.storeUri) {
    if (scan.photoCount > 0) {
      await setSwiftLegacyMigrationStatus('photos_only');
      throw new Error(
        `Found ${scan.photoCount} old photos, but no Swift database (searched Application Support, Documents, and Library for .store/.sqlite). Reviews cannot be rebuilt from photos alone. If you have a .gustra backup, use Backup / Restore.`,
      );
    }
    await setSwiftLegacyMigrationStatus('no_store');
    throw new Error(
      'No previous Gustra database found under Application Support, Documents, or Library.',
    );
  }

  const protectBackupUri = await writeAutoProtectSnapshot({
    restaurants: currentRestaurants,
    reviews: currentReviews,
  });

  const { restaurants: restaurantsBackup, reviews: reviewsBackup } =
    await readSwiftPackageFromStore(scan.storeUri);

  const payload: BackupPayload = {
    schemaVersion: 1,
    appVersion: 'swift-migrate',
    exportedAt: Date.now() / 1000 - APPLE_REFERENCE_DATE_OFFSET,
    restaurants: restaurantsBackup,
    reviews: reviewsBackup,
    photoFiles: {},
  };

  const useOverwrite = looksLikeSeedMockData(currentReviews);
  const next = await applyBackupPayload({
    payload,
    mode: useOverwrite ? 'overwrite' : 'merge',
    currentRestaurants: useOverwrite ? [] : currentRestaurants,
    currentReviews: useOverwrite ? [] : currentReviews,
  });

  await setSwiftLegacyMigrationStatus('completed');

  return {
    restaurantCount: next.restaurants.length,
    reviewCount: next.reviews.length,
    photosCopied,
    restaurants: next.restaurants,
    reviews: next.reviews,
    protectBackupUri,
    mode: useOverwrite ? 'overwrite' : 'merge',
  };
}

/**
 * Run once (or until success) after app launch — no user action required.
 * Safe to call repeatedly; respects migration status unless force.
 */
export async function ensureSwiftLegacyMigration(args: {
  currentRestaurants: Restaurant[];
  currentReviews: Review[];
  force?: boolean;
}): Promise<AutoSwiftLegacyResult> {
  if (Platform.OS !== 'ios') {
    return {
      status: 'skipped_platform',
      importResult: null,
      message: 'Swift recovery is iOS-only.',
    };
  }

  const existing = await getSwiftLegacyMigrationStatus();
  if (!args.force && (existing === 'completed' || existing === 'skipped_platform')) {
    return {
      status: existing,
      importResult: null,
      message: 'Swift migration already completed.',
    };
  }

  // Re-check disk every launch until we have a definitive completed/no_store
  // after a real scan — photos_only / failed / pending should retry.
  try {
    // Housekeeping: drop expired AutoProtect snapshots (keeps newest).
    await pruneAutoProtectBackups().catch(() => 0);

    const scan = await scanSwiftLegacyData();
    if (!scan.storeExists) {
      const photosCopied = await copySwiftPhotosToDocuments(scan.photosDirUri);
      if (scan.applicationSupportUri) {
        await copyProfilePhotoIfPresent(scan.applicationSupportUri);
      }
      if (scan.photoCount > 0) {
        await setSwiftLegacyMigrationStatus('photos_only');
        return {
          status: 'photos_only',
          importResult: null,
          message: `Preserved ${photosCopied || scan.photoCount} old photos, but no database was found. Reviews need the Swift store or a .gustra backup.`,
        };
      }
      await setSwiftLegacyMigrationStatus('no_store');
      return {
        status: 'no_store',
        importResult: null,
        message: 'No previous Swift database found.',
      };
    }

    const importResult = await importSwiftLegacyData({
      currentRestaurants: args.currentRestaurants,
      currentReviews: args.currentReviews,
      force: args.force,
    });
    return {
      status: 'completed',
      importResult,
      message: `Recovered ${importResult.reviewCount} reviews (${importResult.mode}).`,
    };
  } catch (error) {
    const status = await getSwiftLegacyMigrationStatus();
    if (status !== 'photos_only' && status !== 'no_store') {
      await setSwiftLegacyMigrationStatus('failed');
    }
    return {
      status: (status === 'photos_only' || status === 'no_store'
        ? status
        : 'failed') as SwiftLegacyMigrationStatus,
      importResult: null,
      message:
        error instanceof Error
          ? error.message
          : 'Could not import previous Gustra data.',
    };
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
