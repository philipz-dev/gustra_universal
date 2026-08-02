import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { stripShippingSeedData, mergeDemoShowcase, stripDemoShowcase } from '@/data/mockReviews';
import type {
  CriterionRating,
  Restaurant,
  RestaurantVisitSummary,
  Review,
  ReviewOrigin,
  WineLabelFiche,
} from '@/data/types';
import { normalizeRestaurant, resolveReviewOrigin } from '@/data/types';
import { formatAbbreviatedDate } from '@/i18n/formatDates';
import {
  applyBackupPayload,
  criteriaSettingsFromPayload,
  decryptBackup,
  exportEncryptedBackup,
  reviewerProfileFromPayload,
  writeAutoProtectSnapshot,
} from '@/services/backup/BackupService';
import {
  criteriaSettingsToBackup,
  reviewerProfileToBackup,
} from '@/services/backup/mapping';
import {
  relocateStoredPhotoRefs,
  stripWineLabelUrisFromPhotoUrls,
} from '@/services/backup/photos';
import { pruneBrokenPhotoRefs } from '@/services/photos/orphanCleanup';
import {
  REVIEWER_PHOTO_BACKUP_KEY,
  type BackupImportMode,
  type BackupPayload,
} from '@/services/backup/types';
import {
  ensureSwiftLegacyMigration,
  importSwiftLegacyData as runSwiftLegacyImport,
  resetSwiftLegacyMigrationStatus,
} from '@/services/migration/SwiftDataMigration';
import { findExistingRestaurant } from '@/services/places/RestaurantMatcher';
import type { RestaurantDraft } from '@/services/places/types';
import { deleteReviewPhotoFiles } from '@/services/reviews/photoStorage';
import { isReviewDraft } from '@/services/reviews/draftReview';
import { planImportedReviewCollapse } from '@/services/share/ShareImportService';
import {
  RatingValue,
  migrateLegacyCriteria,
  overallScoreFromCriteria,
} from '@/services/reviews/ratings';
import { rebuildSearchableText } from '@/services/reviews/searchableText';
import {
  averageWineUserRating,
  syncWineLabelFields,
  wineLabelsForReview,
} from '@/services/wine/wineLabelTypes';

const STORAGE_KEY = 'gustraReviewsStore.v3';
/** Pre–half-star store (integer 1–5 criterion ratings). */
const LEGACY_STORAGE_KEY = 'gustraReviewsStore.v2';
const DEMO_SHOWCASE_KEY = 'gustra.demoShowcaseEnabled';
const THUMB_COLORS = ['#3D6B52', '#5A4634', '#2F4A3C', '#4A5C3A', '#6B5344'];

type StoredShape = {
  restaurants: Restaurant[];
  reviews: Review[];
};

export type ReviewFormUpsertInput = {
  /** Existing review to edit; omit for a new visit. */
  reviewId?: string;
  draft: RestaurantDraft;
  visitDateIso: string;
  isFavorite: boolean;
  generalComment: string;
  criteria: CriterionRating[];
  photoUrls: string[];
  /** OCR text from review photos (Swift `ocrIndexedText`). */
  ocrText?: string;
  /** Gemini wine-label fiche (additive; primary / compat). */
  wineLabel?: WineLabelFiche | null;
  /** Ordered wine fiches (additive). Dual-written with `wineLabel`. */
  wineLabels?: WineLabelFiche[];
  /** Custom criterion titles for search indexing. */
  customCriterionNames?: string[];
};

export type ReviewFormUpsertResult = {
  reviewId: string;
  restaurantId: string;
};

type ReviewsStoreValue = {
  ready: boolean;
  restaurants: Restaurant[];
  reviews: Review[];
  hasFriendReviews: boolean;
  getRestaurant: (id: string) => Restaurant | undefined;
  getReview: (id: string) => Review | undefined;
  getReviewsForRestaurant: (
    restaurantId: string,
    origin?: ReviewOrigin,
  ) => Review[];
  getFeedSummaries: (origin?: ReviewOrigin) => RestaurantVisitSummary[];
  /**
   * Re-sync restaurant.photoUrl from review photos (call when opening Reviews).
   * Idempotent; persists only when something changed.
   */
  resyncRestaurantCovers: () => Promise<void>;
  /** Deletes the reviews in a feed summary; drops the restaurant if none remain. */
  deleteRestaurantFromFeed: (
    summary: RestaurantVisitSummary,
  ) => Promise<void>;
  setRestaurantFavorite: (
    restaurantId: string,
    isFavorite: boolean,
  ) => Promise<void>;
  /** Create or update a review from the review form (Swift `persistReview`). */
  upsertReviewFromForm: (
    input: ReviewFormUpsertInput,
  ) => Promise<ReviewFormUpsertResult | null>;
  /** Delete one review; drops the restaurant when no visits remain. */
  deleteReview: (reviewId: string) => Promise<void>;
  /** Remove one scanned wine from a review (own reviews only). */
  removeWineFromReview: (
    reviewId: string,
    wineIndex: number,
  ) => Promise<void>;
  createEncryptedBackup: (password: string) => Promise<Uint8Array>;
  importEncryptedBackup: (
    data: Uint8Array,
    password: string,
    mode: BackupImportMode,
  ) => Promise<void>;
  /** Import an unencrypted AutoProtect launch snapshot (merge-safe). */
  importAutoProtectSnapshot: (payload: BackupPayload) => Promise<void>;
  /** Marketing / QA showcase restaurants (fictional names, real addresses). */
  demoShowcaseEnabled: boolean;
  setDemoShowcaseEnabled: (enabled: boolean) => Promise<void>;
  /** Import leftover Swift SwiftData store + Application Support photos. */
  importSwiftLegacyData: () => Promise<{
    restaurantCount: number;
    reviewCount: number;
    photosCopied: number;
    mode: 'overwrite' | 'merge';
  }>;
  /** Auto-run once at launch; safe to call again (idempotent). */
  ensureSwiftLegacyMigration: () => Promise<{
    status: string;
    message: string;
    reviewCount: number;
  }>;
  /** Merge / upsert imported friends reviews from a `.gustrashare` package. */
  importSharePackage: (result: {
    restaurants: Restaurant[];
    reviews: Review[];
    removeReviewIds?: string[];
    removeRestaurantIds?: string[];
  }) => Promise<void>;
};

function newEntityId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function restaurantFromDraft(
  draft: RestaurantDraft,
  isFavorite: boolean,
): Restaurant {
  return normalizeRestaurant({
    id: newEntityId('r'),
    name: draft.name.trim(),
    city: draft.city.trim(),
    country: draft.country.trim(),
    address: draft.streetAddress.trim(),
    phone: draft.phoneNumber.trim() || undefined,
    latitude: draft.latitude,
    longitude: draft.longitude,
    mapItemIdentifier: draft.mapItemIdentifier,
    primaryType: draft.primaryType.trim(),
    isFavorite,
    thumbnailColor: THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)],
    photoUrl: '',
  });
}

function applyDraftToRestaurant(
  restaurant: Restaurant,
  draft: RestaurantDraft,
  isFavorite: boolean,
): Restaurant {
  const placeId = draft.mapItemIdentifier?.trim();
  const draftType = draft.primaryType.trim();
  return normalizeRestaurant({
    ...restaurant,
    name: draft.name.trim() || restaurant.name,
    city: draft.city.trim() || restaurant.city,
    country: draft.country.trim() || restaurant.country,
    address: draft.streetAddress.trim() || restaurant.address,
    phone: draft.phoneNumber.trim() || restaurant.phone,
    latitude: draft.latitude || restaurant.latitude,
    longitude: draft.longitude || restaurant.longitude,
    mapItemIdentifier: placeId || restaurant.mapItemIdentifier,
    primaryType: draftType || restaurant.primaryType,
    isFavorite,
  });
}

const ReviewsStoreContext = createContext<ReviewsStoreValue | null>(null);

function formatAbbreviated(iso: string): string {
  return formatAbbreviatedDate(iso);
}

function normalizeReview(review: Review, migrateLegacy = false): Review {
  const criteria = migrateLegacy
    ? migrateLegacyCriteria(review.criteria ?? [])
    : (review.criteria ?? []).map((c) => ({
        ...c,
        rating: RatingValue.isNotApplicable(c.rating)
          ? RatingValue.notApplicable
          : RatingValue.isStarRating(c.rating)
            ? Math.round(c.rating)
            : RatingValue.unrated,
      }));
  const overallScore =
    overallScoreFromCriteria(criteria) || review.overallScore || 0;
  const ocrText = (review.ocrText ?? '').trim();
  let searchableText = (review.searchableText ?? '').trim();
  if (!searchableText) {
    searchableText = rebuildSearchableText({
      generalComment: review.generalComment ?? '',
      criteria,
      ocrText,
    });
  }
  return {
    ...review,
    photoUrls: (review.photoUrls ?? []).map((u) => u.trim()).filter(Boolean),
    criteria,
    overallScore,
    reviewedById: review.reviewedById?.trim() || undefined,
    reviewedByPhotoUrl: review.reviewedByPhotoUrl?.trim() || undefined,
    origin: resolveReviewOrigin(review),
    searchableText,
    ocrText,
    sourceReviewId: review.sourceReviewId?.trim() || undefined,
  };
}

function reviewerNamesForVisits(visits: Review[]): string | undefined {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const visit of visits) {
    const name = visit.reviewedBy.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names.length > 0 ? names.join(', ') : undefined;
}

/** First non-empty photo URI from a review’s ordered list (cover = index 0). */
function firstPhotoUrl(photoUrls: string[] | undefined): string {
  if (!photoUrls?.length) return '';
  for (const raw of photoUrls) {
    const uri = raw?.trim();
    if (uri) return uri;
  }
  return '';
}

/**
 * Cover for a restaurant: newest visit’s cover photo, else older visits.
 * Keeps Reviews feed in sync after delete / reorder / clear photos.
 */
function coverPhotoForRestaurant(
  restaurantId: string,
  reviews: Review[],
): string {
  const visits = reviews
    .filter((r) => r.restaurantId === restaurantId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  for (const visit of visits) {
    const photo = firstPhotoUrl(visit.photoUrls);
    if (photo) return photo;
  }
  return '';
}

function withRestaurantCover(
  restaurants: Restaurant[],
  restaurantId: string,
  reviews: Review[],
): Restaurant[] {
  const photoUrl = coverPhotoForRestaurant(restaurantId, reviews);
  return restaurants.map((r) =>
    r.id === restaurantId ? { ...r, photoUrl } : r,
  );
}

/** Recompute every restaurant cover from visit photoUrls (newest visit with a photo). */
function withAllRestaurantCovers(
  restaurants: Restaurant[],
  reviews: Review[],
): { restaurants: Restaurant[]; changed: boolean } {
  let changed = false;
  const next = restaurants.map((restaurant) => {
    const photoUrl = coverPhotoForRestaurant(restaurant.id, reviews);
    if ((restaurant.photoUrl ?? '') === photoUrl) return restaurant;
    changed = true;
    return { ...restaurant, photoUrl };
  });
  return { restaurants: next, changed };
}

function buildFeedSummaries(
  restaurants: Restaurant[],
  reviews: Review[],
  origin: ReviewOrigin = 'own',
): RestaurantVisitSummary[] {
  const scoped = reviews.filter((r) => resolveReviewOrigin(r) === origin);
  const summaries: RestaurantVisitSummary[] = [];
  for (const restaurant of restaurants) {
    const visits = scoped
      .filter((r) => r.restaurantId === restaurant.id)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
    if (visits.length === 0) continue;

    const completeVisits = visits.filter((v) => !isReviewDraft(v));
    const draftVisits = visits.filter((v) => isReviewDraft(v));
    const isDraft = completeVisits.length === 0;
    const scoreSource = isDraft ? visits : completeVisits;
    const averageScore =
      scoreSource.length === 0
        ? 0
        : scoreSource.reduce((sum, v) => sum + v.overallScore, 0) /
          scoreSource.length;
    // Cover / recency: prefer complete visits; fall back to drafts.
    const timeline = isDraft ? visits : completeVisits;
    const latestPhoto = coverPhotoForRestaurant(
      restaurant.id,
      isDraft ? visits : completeVisits.length > 0 ? completeVisits : visits,
    );
    summaries.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      city: restaurant.city,
      primaryType: restaurant.primaryType ?? '',
      averageScore: isDraft ? 0 : averageScore,
      visitCount: visits.length,
      lastVisitDate: formatAbbreviated(timeline[0]!.date),
      lastVisitAt: +new Date(timeline[0]!.date),
      reviewerName:
        origin === 'imported' ? reviewerNamesForVisits(visits) : undefined,
      thumbnailColor: restaurant.thumbnailColor,
      photoUrl: latestPhoto,
      isFavorite: restaurant.isFavorite,
      reviewIds: visits.map((v) => v.id),
      isDraft,
      ...(isDraft && draftVisits[0]
        ? { draftReviewId: draftVisits[0].id }
        : {}),
    });
  }
  // Drafts first, then most recent visit.
  return summaries.sort((a, b) => {
    const aDraft = a.isDraft ? 1 : 0;
    const bDraft = b.isDraft ? 1 : 0;
    if (aDraft !== bDraft) return bDraft - aDraft;
    if (a.lastVisitAt !== b.lastVisitAt) return b.lastVisitAt - a.lastVisitAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

async function persist(data: StoredShape) {
  // Never write showcase IDs into the durable store (backups stay clean).
  const cleaned = stripDemoShowcase(data.restaurants, data.reviews);
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      restaurants: cleaned.restaurants,
      reviews: cleaned.reviews,
    }),
  );
}

async function readDemoShowcasePreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_SHOWCASE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

async function writeDemoShowcasePreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DEMO_SHOWCASE_KEY, enabled ? '1' : '0');
  } catch {
    // Preference still held in memory for this session.
  }
}

function withOptionalDemo(
  restaurants: Restaurant[],
  reviews: Review[],
  enabled: boolean,
): StoredShape {
  const cleaned = stripDemoShowcase(restaurants, reviews);
  if (!enabled) return cleaned;
  return mergeDemoShowcase(cleaned.restaurants, cleaned.reviews);
}

export function ReviewsStoreProvider({ children }: { children: ReactNode }) {
  const {
    getBackupSnapshot: getCriteriaSnapshot,
    applyBackupSnapshot: applyCriteriaSnapshot,
  } = useCriteriaSettings();
  const {
    getBackupSnapshot: getProfileSnapshot,
    applyBackupSnapshot: applyProfileSnapshot,
  } = useReviewerProfile();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [demoShowcaseEnabled, setDemoShowcaseEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const restaurantsRef = useRef(restaurants);
  const reviewsRef = useRef(reviews);
  /** Serialize form upserts so autosave + Done cannot create duplicate restaurants. */
  const upsertChainRef = useRef(Promise.resolve());
  restaurantsRef.current = restaurants;
  reviewsRef.current = reviews;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rawV3 = await AsyncStorage.getItem(STORAGE_KEY);
        const rawLegacy = rawV3
          ? null
          : await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        const raw = rawV3 ?? rawLegacy;
        const migrateLegacy = Boolean(!rawV3 && rawLegacy);

        if (raw) {
          const parsed = JSON.parse(raw) as StoredShape;
          if (
            !cancelled &&
            Array.isArray(parsed.restaurants) &&
            Array.isArray(parsed.reviews)
          ) {
            const normalizedReviews = parsed.reviews.map((r) =>
              normalizeReview(r as Review, migrateLegacy),
            );
            const normalizedRestaurants = parsed.restaurants.map((r) =>
              normalizeRestaurant(r as Restaurant),
            );
            // Drop shipping demo seed; keep only user-created data.
            const cleaned = stripShippingSeedData(
              normalizedRestaurants,
              normalizedReviews,
            );
            const collapse = planImportedReviewCollapse(
              cleaned.reviews,
              cleaned.restaurants,
            );
            let hydratedReviews = cleaned.reviews;
            let hydratedRestaurants = cleaned.restaurants;
            if (collapse.removeReviewIds.length > 0) {
              const dropReviews = new Set(collapse.removeReviewIds);
              const dropRestaurants = new Set(collapse.removeRestaurantIds);
              hydratedReviews = hydratedReviews.filter(
                (r) => !dropReviews.has(r.id),
              );
              const used = new Set(
                hydratedReviews.map((r) => r.restaurantId).filter(Boolean),
              );
              hydratedRestaurants = hydratedRestaurants.filter(
                (r) => used.has(r.id) && !dropRestaurants.has(r.id),
              );
            }
            // Rewrite absolute photo URIs to the current Documents sandbox
            // (container UUID can change across app updates / reinstalls).
            const relocated = relocateStoredPhotoRefs({
              restaurants: hydratedRestaurants,
              reviews: hydratedReviews,
            });
            hydratedRestaurants = relocated.restaurants;
            hydratedReviews = relocated.reviews;
            // Drop broken photo references — refs whose local file no longer
            // exists on disk (orphaned paths after a restore / sandbox change)
            // would otherwise render as empty slots in the edit strip and as
            // blank covers in the feed. Remote demo URLs are always kept.
            const pruned = await pruneBrokenPhotoRefs({
              reviews: hydratedReviews,
              restaurants: hydratedRestaurants,
            });
            hydratedRestaurants = pruned.restaurants;
            hydratedReviews = pruned.reviews;
            const demoOn = await readDemoShowcasePreference();
            const withDemo = withOptionalDemo(
              hydratedRestaurants,
              hydratedReviews,
              demoOn,
            );
            if (!cancelled) {
              setDemoShowcaseEnabledState(demoOn);
              setRestaurants(withDemo.restaurants);
              setReviews(withDemo.reviews);
            }
            await persist({
              restaurants: hydratedRestaurants,
              reviews: hydratedReviews,
            });
            if (migrateLegacy) {
              await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
            }
            if (!cancelled) setReady(true);
            // Auto-recover Swift sandbox data after hydrate (iOS only).
            void (async () => {
              try {
                const auto = await ensureSwiftLegacyMigration({
                  currentRestaurants: hydratedRestaurants,
                  currentReviews: hydratedReviews,
                });
                if (auto.importResult && !cancelled) {
                  const restaurants = auto.importResult.restaurants.map(
                    normalizeRestaurant,
                  );
                  const reviews = auto.importResult.reviews.map((r) =>
                    normalizeReview(r),
                  );
                  const relocatedImport = relocateStoredPhotoRefs({
                    restaurants,
                    reviews,
                  });
                  const demoPref = await readDemoShowcasePreference();
                  const merged = withOptionalDemo(
                    relocatedImport.restaurants,
                    relocatedImport.reviews,
                    demoPref,
                  );
                  setRestaurants(merged.restaurants);
                  setReviews(merged.reviews);
                  await persist({
                    restaurants: relocatedImport.restaurants,
                    reviews: relocatedImport.reviews,
                  });
                }
              } catch {
                // Non-fatal — Settings Recover remains available.
              }
            })();
            return;
          }
        }
        // Fresh install / empty store — no demo seed unless preference is on.
        if (!cancelled) {
          const demoOn = await readDemoShowcasePreference();
          const empty = withOptionalDemo([], [], demoOn);
          setDemoShowcaseEnabledState(demoOn);
          setRestaurants(empty.restaurants);
          setReviews(empty.reviews);
          await persist({ restaurants: [], reviews: [] });
          setReady(true);
          void (async () => {
            try {
              const auto = await ensureSwiftLegacyMigration({
                currentRestaurants: [],
                currentReviews: [],
              });
              if (auto.importResult && !cancelled) {
                const restaurants = auto.importResult.restaurants.map(
                  normalizeRestaurant,
                );
                const reviews = auto.importResult.reviews.map((r) =>
                  normalizeReview(r),
                );
                const relocatedImport = relocateStoredPhotoRefs({
                  restaurants,
                  reviews,
                });
                const demoPref = await readDemoShowcasePreference();
                const merged = withOptionalDemo(
                  relocatedImport.restaurants,
                  relocatedImport.reviews,
                  demoPref,
                );
                setRestaurants(merged.restaurants);
                setReviews(merged.reviews);
                await persist({
                  restaurants: relocatedImport.restaurants,
                  reviews: relocatedImport.reviews,
                });
              }
            } catch {
              // Non-fatal
            }
          })();
        }
      } catch {
        if (!cancelled) {
          setRestaurants([]);
          setReviews([]);
          setReady(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // On-launch automatic snapshot: write a lightweight AutoProtect JSON once
  // the store is loaded, so recent reviews survive even without a manual
  // encrypted backup. Only `AutoProtect-launch-*` files are created; encrypted
  // `.gustra` backups are never touched by the retention/pruning.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const [profileSnap, criteriaSnap] = await Promise.all([
            getProfileSnapshot(),
            Promise.resolve(getCriteriaSnapshot()),
          ]);
          const photoFiles: Record<string, string> = {};
          if (profileSnap.photoBase64) {
            photoFiles[REVIEWER_PHOTO_BACKUP_KEY] = profileSnap.photoBase64;
          }
          const userOnly = stripDemoShowcase(
            restaurantsRef.current,
            reviewsRef.current,
          );
          await writeAutoProtectSnapshot({
            restaurants: userOnly.restaurants,
            reviews: userOnly.reviews,
            reviewerProfile: reviewerProfileToBackup({
              name: profileSnap.name,
              hasPhoto: Boolean(profileSnap.photoBase64),
              authorId: profileSnap.authorId,
            }),
            criteriaSettings: criteriaSettingsToBackup(criteriaSnap),
          });
        } catch {
          // Non-fatal — manual backup remains available in Settings.
        }
      })();
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, getCriteriaSnapshot, getProfileSnapshot]);

  const getRestaurant = useCallback(
    (id: string) => restaurants.find((r) => r.id === id),
    [restaurants],
  );

  const getReview = useCallback(
    (id: string) => reviews.find((r) => r.id === id),
    [reviews],
  );

  const hasFriendReviews = useMemo(
    () => reviews.some((r) => resolveReviewOrigin(r) === 'imported'),
    [reviews],
  );

  const getReviewsForRestaurant = useCallback(
    (restaurantId: string, origin?: ReviewOrigin) =>
      reviews
        .filter((r) => r.restaurantId === restaurantId)
        .filter((r) =>
          origin ? resolveReviewOrigin(r) === origin : true,
        )
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [reviews],
  );

  const getFeedSummaries = useCallback(
    (origin: ReviewOrigin = 'own') =>
      buildFeedSummaries(restaurants, reviews, origin),
    [restaurants, reviews],
  );

  const resyncRestaurantCovers = useCallback(async () => {
    const { restaurants: nextRestaurants, changed } = withAllRestaurantCovers(
      restaurantsRef.current,
      reviewsRef.current,
    );
    if (!changed) return;
    restaurantsRef.current = nextRestaurants;
    setRestaurants(nextRestaurants);
    await persist({
      restaurants: nextRestaurants,
      reviews: reviewsRef.current,
    });
  }, []);

  const deleteRestaurantFromFeed = useCallback(
    async (summary: RestaurantVisitSummary) => {
      const reviewIds = new Set(summary.reviewIds);
      const removed = reviews.filter((r) => reviewIds.has(r.id));
      const nextReviews = reviews.filter((r) => !reviewIds.has(r.id));
      const stillHasReviews = nextReviews.some(
        (r) => r.restaurantId === summary.restaurantId,
      );
      const nextRestaurants = stillHasReviews
        ? withRestaurantCover(
            restaurants,
            summary.restaurantId,
            nextReviews,
          )
        : restaurants.filter((r) => r.id !== summary.restaurantId);
      setReviews(nextReviews);
      setRestaurants(nextRestaurants);
      await persist({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });

      const uris = removed.flatMap((r) => [
        ...r.photoUrls,
        ...(r.reviewedByPhotoUrl ? [r.reviewedByPhotoUrl] : []),
      ]);
      const restaurant = restaurants.find((r) => r.id === summary.restaurantId);
      if (!stillHasReviews && restaurant?.photoUrl) {
        uris.push(restaurant.photoUrl);
      }
      void deleteReviewPhotoFiles(uris);
      // Catch any leftover keys still on disk after the direct deletes.
      void import('@/services/photos/orphanCleanup').then(
        ({ performStartupPhotoMaintenance }) =>
          performStartupPhotoMaintenance(nextReviews, {
            restaurants: nextRestaurants,
          }),
      );
    },
    [restaurants, reviews],
  );

  const setRestaurantFavorite = useCallback(
    async (restaurantId: string, isFavorite: boolean) => {
      const nextRestaurants = restaurants.map((restaurant) =>
        restaurant.id === restaurantId
          ? { ...restaurant, isFavorite }
          : restaurant,
      );
      setRestaurants(nextRestaurants);
      await persist({ restaurants: nextRestaurants, reviews });
    },
    [restaurants, reviews],
  );

  // Swift `PlaceTypeBackfillService.backfillMissingTypesIfNeeded` at launch.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const { backfillMissingPrimaryTypes } = await import(
        '@/services/places/PlaceTypeBackfillService'
      );
      if (cancelled) return;
      const updates = await backfillMissingPrimaryTypes(
        restaurantsRef.current,
      );
      if (cancelled || updates.length === 0) return;
      const byId = new Map(
        updates.map((u) => [u.restaurantId, u.primaryType] as const),
      );
      const nextRestaurants = restaurantsRef.current.map((restaurant) => {
        const primaryType = byId.get(restaurant.id);
        return primaryType ? { ...restaurant, primaryType } : restaurant;
      });
      restaurantsRef.current = nextRestaurants;
      setRestaurants(nextRestaurants);
      await persist({
        restaurants: nextRestaurants,
        reviews: reviewsRef.current,
      });
    })().catch(() => {
      // Silent — quota / network failures are tracked as failed place IDs.
    });
    return () => {
      cancelled = true;
    };
    // Run once when the store becomes ready (snapshot restaurants at that moment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Swift `ImageCompressionService.performStartupPhotoMaintenance` at launch.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const { performStartupPhotoMaintenance } = await import(
        '@/services/photos/orphanCleanup'
      );
      if (cancelled) return;
      await performStartupPhotoMaintenance(reviewsRef.current, {
        restaurants: restaurantsRef.current,
      });
    })().catch(() => {
      // Silent — disk cleanup must never block launch.
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const upsertReviewFromForm = useCallback(
    async (input: ReviewFormUpsertInput): Promise<ReviewFormUpsertResult | null> => {
      let result: ReviewFormUpsertResult | null = null;

      const run = async () => {
        const draftName = input.draft.name.trim();
        if (!draftName) return;

        // Always read the latest snapshot — concurrent autosave/Done must not
        // each spawn a new restaurant from a stale empty/partial array.
        let nextRestaurants = [...restaurantsRef.current];
        let nextReviews = [...reviewsRef.current];

        const existingReview = input.reviewId
          ? nextReviews.find((r) => r.id === input.reviewId)
          : undefined;

        let restaurant: Restaurant | undefined;
        if (existingReview) {
          restaurant = nextRestaurants.find(
            (r) => r.id === existingReview.restaurantId,
          );
        }
        if (!restaurant) {
          restaurant = findExistingRestaurant(input.draft, nextRestaurants);
        }

        if (restaurant) {
          restaurant = applyDraftToRestaurant(
            restaurant,
            input.draft,
            input.isFavorite,
          );
          nextRestaurants = nextRestaurants.map((r) =>
            r.id === restaurant!.id ? restaurant! : r,
          );
        } else {
          restaurant = restaurantFromDraft(input.draft, input.isFavorite);
          nextRestaurants = [...nextRestaurants, restaurant];
        }

        const criteria = input.criteria.map((c) => ({
          ...c,
          comment: c.comment.trim(),
          rating: RatingValue.isNotApplicable(c.rating)
            ? RatingValue.notApplicable
            : RatingValue.isStarRating(c.rating)
              ? Math.round(c.rating)
              : RatingValue.unrated,
        }));
        const overallScore = overallScoreFromCriteria(criteria);
        const ocrText = (input.ocrText ?? existingReview?.ocrText ?? '').trim();
        const wineFields =
          input.wineLabels !== undefined || input.wineLabel !== undefined
            ? syncWineLabelFields(
                input.wineLabels !== undefined
                  ? input.wineLabels
                  : input.wineLabel
                    ? [input.wineLabel]
                    : [],
              )
            : syncWineLabelFields(wineLabelsForReview(existingReview));
        const photoUrls = stripWineLabelUrisFromPhotoUrls(
          input.photoUrls.map((u) => u.trim()).filter(Boolean),
          wineLabelsForReview(wineFields),
        );
        const searchableText = rebuildSearchableText({
          restaurant,
          generalComment: input.generalComment.trim(),
          criteria,
          customCriterionNames: input.customCriterionNames,
          ocrText,
          wineLabel: wineFields.wineLabel,
          wineLabels: wineFields.wineLabels,
        });

        let reviewId = existingReview?.id;
        let reviewToUpdate = existingReview;
        if (!reviewToUpdate) {
          // Concurrent autosave/Done without reviewId: reuse the visit just
          // created for this restaurant + exact visit timestamp.
          reviewToUpdate = nextReviews.find(
            (r) =>
              r.restaurantId === restaurant!.id &&
              resolveReviewOrigin(r) === 'own' &&
              r.date === input.visitDateIso,
          );
          reviewId = reviewToUpdate?.id;
        }

        if (reviewToUpdate) {
          nextReviews = nextReviews.map((r) =>
            r.id === reviewToUpdate!.id
              ? {
                  ...r,
                  restaurantId: restaurant!.id,
                  date: input.visitDateIso,
                  generalComment: input.generalComment.trim(),
                  criteria,
                  photoUrls,
                  overallScore,
                  origin: resolveReviewOrigin(r),
                  searchableText,
                  ocrText,
                  wineLabel: wineFields.wineLabel,
                  wineLabels: wineFields.wineLabels,
                }
              : r,
          );
        } else {
          reviewId = newEntityId('v');
          nextReviews = [
            ...nextReviews,
            {
              id: reviewId,
              restaurantId: restaurant.id,
              date: input.visitDateIso,
              generalComment: input.generalComment.trim(),
              criteria,
              photoUrls,
              reviewedBy: '',
              overallScore,
              origin: 'own',
              searchableText,
              ocrText,
              wineLabel: wineFields.wineLabel,
              wineLabels: wineFields.wineLabels,
            },
          ];
        }

        nextRestaurants = withRestaurantCover(
          nextRestaurants,
          restaurant.id,
          nextReviews,
        );
        restaurant =
          nextRestaurants.find((r) => r.id === restaurant!.id) ?? restaurant;

        restaurantsRef.current = nextRestaurants;
        reviewsRef.current = nextReviews;
        setRestaurants(nextRestaurants);
        setReviews(nextReviews);
        await persist({
          restaurants: nextRestaurants,
          reviews: nextReviews,
        });

        result = { reviewId: reviewId!, restaurantId: restaurant.id };
      };

      const queued = upsertChainRef.current.then(run, run);
      upsertChainRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      await queued;
      return result;
    },
    [],
  );

  const deleteReview = useCallback(
    async (reviewId: string) => {
      const target = reviews.find((r) => r.id === reviewId);
      if (!target) return;

      const nextReviews = reviews.filter((r) => r.id !== reviewId);
      const stillHasReviews = nextReviews.some(
        (r) => r.restaurantId === target.restaurantId,
      );
      const nextRestaurants = stillHasReviews
        ? withRestaurantCover(
            restaurants,
            target.restaurantId,
            nextReviews,
          )
        : restaurants.filter((r) => r.id !== target.restaurantId);

      setReviews(nextReviews);
      setRestaurants(nextRestaurants);
      await persist({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });

      const uris = [
        ...target.photoUrls,
        ...(target.reviewedByPhotoUrl ? [target.reviewedByPhotoUrl] : []),
      ];
      void deleteReviewPhotoFiles(uris);
      void import('@/services/photos/orphanCleanup').then(
        ({ performStartupPhotoMaintenance }) =>
          performStartupPhotoMaintenance(nextReviews, {
            restaurants: nextRestaurants,
          }),
      );
    },
    [restaurants, reviews],
  );

  const removeWineFromReview = useCallback(
    async (reviewId: string, wineIndex: number) => {
      const target = reviewsRef.current.find((r) => r.id === reviewId);
      if (!target || resolveReviewOrigin(target) === 'imported') return;

      const wines = wineLabelsForReview(target);
      if (wineIndex < 0 || wineIndex >= wines.length) return;

      const removed = wines[wineIndex];
      const nextWines = wines.filter((_, i) => i !== wineIndex);
      const wineFields = syncWineLabelFields(nextWines);
      const avg = averageWineUserRating(nextWines);
      const criteria = target.criteria.map((c) => {
        if (c.id !== 'wines' || avg == null) return c;
        return { ...c, rating: avg };
      });
      const overallScore = overallScoreFromCriteria(criteria);
      const restaurant = restaurantsRef.current.find(
        (r) => r.id === target.restaurantId,
      );
      const searchableText = rebuildSearchableText({
        restaurant,
        generalComment: target.generalComment ?? '',
        criteria,
        ocrText: target.ocrText,
        wineLabel: wineFields.wineLabel,
        wineLabels: wineFields.wineLabels,
      });
      const removedUri = removed?.labelPhotoUri?.trim();
      const gallery = (target.photoUrls ?? []).filter((u) => {
        const t = u.trim();
        return t && (!removedUri || t !== removedUri);
      });
      const photoUrls = stripWineLabelUrisFromPhotoUrls(gallery, nextWines);

      const nextReviews = reviewsRef.current.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              criteria,
              overallScore,
              searchableText,
              photoUrls,
              wineLabel: wineFields.wineLabel,
              wineLabels: wineFields.wineLabels,
            }
          : r,
      );
      reviewsRef.current = nextReviews;
      setReviews(nextReviews);
      await persist({
        restaurants: restaurantsRef.current,
        reviews: nextReviews,
      });

      const uri = removed?.labelPhotoUri?.trim();
      if (uri) void deleteReviewPhotoFiles([uri]);
    },
    [],
  );

  const createEncryptedBackup = useCallback(
    async (password: string) => {
      const [profileSnap, criteriaSnap] = await Promise.all([
        getProfileSnapshot(),
        Promise.resolve(getCriteriaSnapshot()),
      ]);
      const photoFiles: Record<string, string> = {};
      if (profileSnap.photoBase64) {
        photoFiles[REVIEWER_PHOTO_BACKUP_KEY] = profileSnap.photoBase64;
      }
      // Local review photos are collected inside exportEncryptedBackup (Swift parity).
      // Showcase data is never included in backups.
      const userOnly = stripDemoShowcase(restaurants, reviews);
      return exportEncryptedBackup({
        restaurants: userOnly.restaurants,
        reviews: userOnly.reviews,
        password,
        photoFiles,
        reviewerProfile: reviewerProfileToBackup({
          name: profileSnap.name,
          hasPhoto: Boolean(profileSnap.photoBase64),
          authorId: profileSnap.authorId,
        }),
        criteriaSettings: criteriaSettingsToBackup(criteriaSnap),
      });
    },
    [getCriteriaSnapshot, getProfileSnapshot, restaurants, reviews],
  );

  const setDemoShowcaseEnabled = useCallback(async (enabled: boolean) => {
    setDemoShowcaseEnabledState(enabled);
    await writeDemoShowcasePreference(enabled);
    const userOnly = stripDemoShowcase(
      restaurantsRef.current,
      reviewsRef.current,
    );
    const next = withOptionalDemo(
      userOnly.restaurants,
      userOnly.reviews,
      enabled,
    );
    setRestaurants(next.restaurants);
    setReviews(next.reviews);
    await persist({
      restaurants: userOnly.restaurants,
      reviews: userOnly.reviews,
    });
  }, []);

  const importEncryptedBackup = useCallback(
    async (data: Uint8Array, password: string, mode: BackupImportMode) => {
      const payload = decryptBackup(data, password);
      const userOnly = stripDemoShowcase(restaurants, reviews);
      const next = await applyBackupPayload({
        payload,
        mode,
        currentRestaurants: userOnly.restaurants,
        currentReviews: userOnly.reviews,
      });
      const relocated = relocateStoredPhotoRefs(next);
      const merged = withOptionalDemo(
        relocated.restaurants,
        relocated.reviews,
        demoShowcaseEnabled,
      );
      setRestaurants(merged.restaurants);
      setReviews(merged.reviews);
      await persist({
        restaurants: relocated.restaurants,
        reviews: relocated.reviews,
      });

      const profile = reviewerProfileFromPayload(payload);
      if (profile) {
        await applyProfileSnapshot({
          name: profile.profile.name,
          photoBase64: profile.photoBase64,
          authorId: profile.profile.authorId ?? undefined,
        });
      }

      const criteria = criteriaSettingsFromPayload(payload);
      if (criteria) {
        await applyCriteriaSnapshot(criteria);
      }
    },
    [
      applyCriteriaSnapshot,
      applyProfileSnapshot,
      demoShowcaseEnabled,
      restaurants,
      reviews,
    ],
  );

  /** Import an unencrypted AutoProtect launch snapshot (always merge-safe). */
  const importAutoProtectSnapshot = useCallback(
    async (payload: BackupPayload) => {
      const userOnly = stripDemoShowcase(restaurants, reviews);
      const next = await applyBackupPayload({
        payload,
        mode: 'merge',
        currentRestaurants: userOnly.restaurants,
        currentReviews: userOnly.reviews,
      });
      const relocated = relocateStoredPhotoRefs(next);
      const merged = withOptionalDemo(
        relocated.restaurants,
        relocated.reviews,
        demoShowcaseEnabled,
      );
      setRestaurants(merged.restaurants);
      setReviews(merged.reviews);
      await persist({
        restaurants: relocated.restaurants,
        reviews: relocated.reviews,
      });

      const profile = reviewerProfileFromPayload(payload);
      if (profile) {
        await applyProfileSnapshot({
          name: profile.profile.name,
          photoBase64: profile.photoBase64,
          authorId: profile.profile.authorId ?? undefined,
        });
      }
      const criteria = criteriaSettingsFromPayload(payload);
      if (criteria) {
        await applyCriteriaSnapshot(criteria);
      }
    },
    [
      applyCriteriaSnapshot,
      applyProfileSnapshot,
      demoShowcaseEnabled,
      restaurants,
      reviews,
    ],
  );

  const importSwiftLegacyData = useCallback(async () => {
    await resetSwiftLegacyMigrationStatus();
    const result = await runSwiftLegacyImport({
      currentRestaurants: restaurantsRef.current,
      currentReviews: reviewsRef.current,
      force: true,
    });
    const restaurants = result.restaurants.map(normalizeRestaurant);
    const reviews = result.reviews.map((r) => normalizeReview(r));
    const relocated = relocateStoredPhotoRefs({ restaurants, reviews });
    setRestaurants(relocated.restaurants);
    setReviews(relocated.reviews);
    await persist({
      restaurants: relocated.restaurants,
      reviews: relocated.reviews,
    });
    return {
      restaurantCount: result.restaurantCount,
      reviewCount: result.reviewCount,
      photosCopied: result.photosCopied,
      mode: result.mode,
    };
  }, []);

  const runEnsureSwiftLegacyMigration = useCallback(async () => {
    const auto = await ensureSwiftLegacyMigration({
      currentRestaurants: restaurantsRef.current,
      currentReviews: reviewsRef.current,
    });
    if (auto.importResult) {
      const restaurants = auto.importResult.restaurants.map(normalizeRestaurant);
      const reviews = auto.importResult.reviews.map((r) => normalizeReview(r));
      const relocated = relocateStoredPhotoRefs({ restaurants, reviews });
      setRestaurants(relocated.restaurants);
      setReviews(relocated.reviews);
      await persist({
        restaurants: relocated.restaurants,
        reviews: relocated.reviews,
      });
    }
    return {
      status: auto.status,
      message: auto.message,
      reviewCount: auto.importResult?.reviewCount ?? 0,
    };
  }, []);

  const importSharePackage = useCallback(
    async (result: {
      restaurants: Restaurant[];
      reviews: Review[];
      removeReviewIds?: string[];
      removeRestaurantIds?: string[];
    }) => {
      if (
        result.reviews.length === 0 &&
        !(result.removeReviewIds?.length) &&
        !(result.removeRestaurantIds?.length)
      ) {
        return;
      }

      const removeReviewIds = new Set(result.removeReviewIds ?? []);
      const removeRestaurantIds = new Set(result.removeRestaurantIds ?? []);

      const userBaseline = stripDemoShowcase(restaurants, reviews);
      let nextReviews = userBaseline.reviews.filter(
        (r) => !removeReviewIds.has(r.id),
      );
      for (const incoming of result.reviews.map((r) => normalizeReview(r))) {
        const index = nextReviews.findIndex((r) => r.id === incoming.id);
        if (index >= 0) nextReviews[index] = incoming;
        else nextReviews.push(incoming);
      }

      let nextRestaurants = userBaseline.restaurants.filter(
        (r) => !removeRestaurantIds.has(r.id),
      );
      for (const incoming of result.restaurants.map((r) =>
        normalizeRestaurant(r),
      )) {
        const index = nextRestaurants.findIndex((r) => r.id === incoming.id);
        if (index >= 0) {
          nextRestaurants[index] = normalizeRestaurant({
            ...incoming,
            isFavorite:
              nextRestaurants[index]!.isFavorite || incoming.isFavorite,
          });
        } else {
          nextRestaurants.push(incoming);
        }
      }

      // Second pass: collapse any remaining friend duplicates already on device.
      const collapse = planImportedReviewCollapse(
        nextReviews,
        nextRestaurants,
      );
      if (collapse.removeReviewIds.length > 0) {
        const extraRemove = new Set(collapse.removeReviewIds);
        nextReviews = nextReviews.filter((r) => !extraRemove.has(r.id));
      }
      if (collapse.removeRestaurantIds.length > 0) {
        const extraRest = new Set(collapse.removeRestaurantIds);
        nextRestaurants = nextRestaurants.filter((r) => !extraRest.has(r.id));
      }

      // Drop restaurants that no longer have any visits (e.g. collapsed dupes).
      const usedRestaurantIds = new Set(
        nextReviews.map((r) => r.restaurantId).filter(Boolean),
      );
      nextRestaurants = nextRestaurants.filter((r) =>
        usedRestaurantIds.has(r.id),
      );

      const relocated = relocateStoredPhotoRefs({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });
      const userOnly = stripDemoShowcase(
        relocated.restaurants,
        relocated.reviews,
      );
      const merged = withOptionalDemo(
        userOnly.restaurants,
        userOnly.reviews,
        demoShowcaseEnabled,
      );
      setRestaurants(merged.restaurants);
      setReviews(merged.reviews);
      await persist({
        restaurants: userOnly.restaurants,
        reviews: userOnly.reviews,
      });
    },
    [demoShowcaseEnabled, restaurants, reviews],
  );

  const value = useMemo(
    () => ({
      ready,
      restaurants,
      reviews,
      hasFriendReviews,
      getRestaurant,
      getReview,
      getReviewsForRestaurant,
      getFeedSummaries,
      resyncRestaurantCovers,
      deleteRestaurantFromFeed,
      setRestaurantFavorite,
      upsertReviewFromForm,
      deleteReview,
      removeWineFromReview,
      createEncryptedBackup,
      importEncryptedBackup,
      importAutoProtectSnapshot,
      demoShowcaseEnabled,
      setDemoShowcaseEnabled,
      importSwiftLegacyData,
      ensureSwiftLegacyMigration: runEnsureSwiftLegacyMigration,
      importSharePackage,
    }),
    [
      ready,
      restaurants,
      reviews,
      hasFriendReviews,
      getRestaurant,
      getReview,
      getReviewsForRestaurant,
      getFeedSummaries,
      resyncRestaurantCovers,
      deleteRestaurantFromFeed,
      setRestaurantFavorite,
      upsertReviewFromForm,
      deleteReview,
      removeWineFromReview,
      createEncryptedBackup,
      importEncryptedBackup,
      importAutoProtectSnapshot,
      demoShowcaseEnabled,
      setDemoShowcaseEnabled,
      importSwiftLegacyData,
      runEnsureSwiftLegacyMigration,
      importSharePackage,
    ],
  );

  return (
    <ReviewsStoreContext.Provider value={value}>
      {children}
    </ReviewsStoreContext.Provider>
  );
}

export function useReviewsStore(): ReviewsStoreValue {
  const ctx = useContext(ReviewsStoreContext);
  if (!ctx) {
    throw new Error('useReviewsStore must be used within ReviewsStoreProvider');
  }
  return ctx;
}
