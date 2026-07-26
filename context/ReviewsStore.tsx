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
import { stripShippingSeedData } from '@/data/mockReviews';
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
} from '@/services/backup/BackupService';
import {
  criteriaSettingsToBackup,
  reviewerProfileToBackup,
} from '@/services/backup/mapping';
import {
  REVIEWER_PHOTO_BACKUP_KEY,
  type BackupImportMode,
} from '@/services/backup/types';
import {
  ensureSwiftLegacyMigration,
  importSwiftLegacyData as runSwiftLegacyImport,
  resetSwiftLegacyMigrationStatus,
} from '@/services/migration/SwiftDataMigration';
import { findExistingRestaurant } from '@/services/places/RestaurantMatcher';
import type { RestaurantDraft } from '@/services/places/types';
import { deleteReviewPhotoFiles } from '@/services/reviews/photoStorage';
import { planImportedReviewCollapse } from '@/services/share/ShareImportService';
import {
  RatingValue,
  migrateLegacyCriteria,
  overallScoreFromCriteria,
} from '@/services/reviews/ratings';
import { rebuildSearchableText } from '@/services/reviews/searchableText';

const STORAGE_KEY = 'gustraReviewsStore.v3';
/** Pre–half-star store (integer 1–5 criterion ratings). */
const LEGACY_STORAGE_KEY = 'gustraReviewsStore.v2';
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
  /** Gemini wine-label fiche (additive). */
  wineLabel?: WineLabelFiche | null;
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
  createEncryptedBackup: (password: string) => Promise<Uint8Array>;
  importEncryptedBackup: (
    data: Uint8Array,
    password: string,
    mode: BackupImportMode,
  ) => Promise<void>;
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
    const averageScore =
      visits.reduce((sum, v) => sum + v.overallScore, 0) / visits.length;
    const latestPhoto = coverPhotoForRestaurant(restaurant.id, visits);
    summaries.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      city: restaurant.city,
      primaryType: restaurant.primaryType ?? '',
      averageScore,
      visitCount: visits.length,
      lastVisitDate: formatAbbreviated(visits[0].date),
      lastVisitAt: +new Date(visits[0].date),
      // Owner name is not shown on My reviews — only friends' authors on Friends' feed.
      reviewerName:
        origin === 'imported' ? reviewerNamesForVisits(visits) : undefined,
      thumbnailColor: restaurant.thumbnailColor,
      photoUrl: latestPhoto,
      isFavorite: restaurant.isFavorite,
      reviewIds: visits.map((v) => v.id),
    });
  }
  // Default order: most recent visit first (filters may re-rank).
  return summaries.sort((a, b) => {
    if (a.lastVisitAt !== b.lastVisitAt) return b.lastVisitAt - a.lastVisitAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

async function persist(data: StoredShape) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
            setRestaurants(hydratedRestaurants);
            setReviews(hydratedReviews);
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
                  setRestaurants(restaurants);
                  setReviews(reviews);
                  await persist({ restaurants, reviews });
                }
              } catch {
                // Non-fatal — Settings Recover remains available.
              }
            })();
            return;
          }
        }
        // Fresh install / empty store — no demo seed.
        if (!cancelled) {
          setRestaurants([]);
          setReviews([]);
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
                setRestaurants(restaurants);
                setReviews(reviews);
                await persist({ restaurants, reviews });
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
        const photoUrls = input.photoUrls.map((u) => u.trim()).filter(Boolean);
        const overallScore = overallScoreFromCriteria(criteria);
        const ocrText = (input.ocrText ?? existingReview?.ocrText ?? '').trim();
        const wineLabel =
          input.wineLabel !== undefined
            ? input.wineLabel
            : (existingReview?.wineLabel ?? null);
        const searchableText = rebuildSearchableText({
          restaurant,
          generalComment: input.generalComment.trim(),
          criteria,
          customCriterionNames: input.customCriterionNames,
          ocrText,
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
                  wineLabel,
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
              wineLabel,
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
      return exportEncryptedBackup({
        restaurants,
        reviews,
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

  const importEncryptedBackup = useCallback(
    async (data: Uint8Array, password: string, mode: BackupImportMode) => {
      const payload = decryptBackup(data, password);
      const next = await applyBackupPayload({
        payload,
        mode,
        currentRestaurants: restaurants,
        currentReviews: reviews,
      });
      setRestaurants(next.restaurants);
      setReviews(next.reviews);
      await persist(next);

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
    setRestaurants(restaurants);
    setReviews(reviews);
    await persist({ restaurants, reviews });
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
      setRestaurants(restaurants);
      setReviews(reviews);
      await persist({ restaurants, reviews });
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

      let nextReviews = reviews.filter((r) => !removeReviewIds.has(r.id));
      for (const incoming of result.reviews.map((r) => normalizeReview(r))) {
        const index = nextReviews.findIndex((r) => r.id === incoming.id);
        if (index >= 0) nextReviews[index] = incoming;
        else nextReviews.push(incoming);
      }

      let nextRestaurants = restaurants.filter(
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

      setRestaurants(nextRestaurants);
      setReviews(nextReviews);
      await persist({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });
    },
    [restaurants, reviews],
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
      deleteRestaurantFromFeed,
      setRestaurantFavorite,
      upsertReviewFromForm,
      deleteReview,
      createEncryptedBackup,
      importEncryptedBackup,
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
      deleteRestaurantFromFeed,
      setRestaurantFavorite,
      upsertReviewFromForm,
      deleteReview,
      createEncryptedBackup,
      importEncryptedBackup,
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
