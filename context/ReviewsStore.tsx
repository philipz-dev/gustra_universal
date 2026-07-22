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
import { mockRestaurants, mockReviews } from '@/data/mockReviews';
import type {
  CriterionRating,
  Restaurant,
  RestaurantVisitSummary,
  Review,
  ReviewOrigin,
} from '@/data/types';
import { normalizeRestaurant, resolveReviewOrigin } from '@/data/types';
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
import { findExistingRestaurant } from '@/services/places/RestaurantMatcher';
import type { RestaurantDraft } from '@/services/places/types';
import { deleteReviewPhotoFiles } from '@/services/reviews/photoStorage';
import {
  RatingValue,
  migrateLegacyCriteria,
  overallScoreFromCriteria,
} from '@/services/reviews/ratings';

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
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  return {
    ...review,
    criteria,
    overallScore,
    reviewedByPhotoUrl: review.reviewedByPhotoUrl?.trim() || undefined,
    origin: resolveReviewOrigin(review),
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
    const latestPhoto = visits[0].photoUrls[0] ?? restaurant.photoUrl;
    summaries.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      city: restaurant.city,
      primaryType: restaurant.primaryType ?? '',
      averageScore,
      visitCount: visits.length,
      lastVisitDate: formatAbbreviated(visits[0].date),
      // Owner name is not shown on My reviews — only friends' authors on Friends' feed.
      reviewerName:
        origin === 'imported' ? reviewerNamesForVisits(visits) : undefined,
      thumbnailColor: restaurant.thumbnailColor,
      photoUrl: latestPhoto,
      isFavorite: restaurant.isFavorite,
      reviewIds: visits.map((v) => v.id),
    });
  }
  return summaries.sort((a, b) => b.averageScore - a.averageScore);
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
            setRestaurants(normalizedRestaurants);
            setReviews(normalizedReviews);
            await persist({
              restaurants: normalizedRestaurants,
              reviews: normalizedReviews,
            });
            if (migrateLegacy) {
              await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
            }
            return;
          }
        }
        if (!cancelled) {
          const seedRestaurants = mockRestaurants.map(normalizeRestaurant);
          const seedReviews = mockReviews.map((r) => normalizeReview(r));
          setRestaurants(seedRestaurants);
          setReviews(seedReviews);
          await persist({
            restaurants: seedRestaurants,
            reviews: seedReviews,
          });
        }
      } catch {
        if (!cancelled) {
          setRestaurants(mockRestaurants.map(normalizeRestaurant));
          setReviews(mockReviews.map((r) => normalizeReview(r)));
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
      const nextReviews = reviews.filter((r) => !reviewIds.has(r.id));
      const stillHasReviews = nextReviews.some(
        (r) => r.restaurantId === summary.restaurantId,
      );
      const nextRestaurants = stillHasReviews
        ? restaurants
        : restaurants.filter((r) => r.id !== summary.restaurantId);
      setReviews(nextReviews);
      setRestaurants(nextRestaurants);
      await persist({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });
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

  const upsertReviewFromForm = useCallback(
    async (input: ReviewFormUpsertInput): Promise<ReviewFormUpsertResult | null> => {
      const draftName = input.draft.name.trim();
      if (!draftName) return null;

      let nextRestaurants = [...restaurants];
      let nextReviews = [...reviews];

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
      const photoUrls = input.photoUrls.filter(Boolean);
      const overallScore = overallScoreFromCriteria(criteria);
      const coverPhoto = photoUrls[0] ?? restaurant.photoUrl;

      restaurant = {
        ...restaurant,
        photoUrl: coverPhoto || restaurant.photoUrl,
      };
      nextRestaurants = nextRestaurants.map((r) =>
        r.id === restaurant!.id ? restaurant! : r,
      );

      let reviewId = existingReview?.id;
      if (existingReview) {
        nextReviews = nextReviews.map((r) =>
          r.id === existingReview.id
            ? {
                ...r,
                restaurantId: restaurant!.id,
                date: input.visitDateIso,
                generalComment: input.generalComment.trim(),
                criteria,
                photoUrls,
                overallScore,
                origin: resolveReviewOrigin(r),
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
          },
        ];
      }

      setRestaurants(nextRestaurants);
      setReviews(nextReviews);
      await persist({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });

      return { reviewId: reviewId!, restaurantId: restaurant.id };
    },
    [restaurants, reviews],
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
        ? restaurants
        : restaurants.filter((r) => r.id !== target.restaurantId);

      setReviews(nextReviews);
      setRestaurants(nextRestaurants);
      await persist({
        restaurants: nextRestaurants,
        reviews: nextReviews,
      });

      void deleteReviewPhotoFiles(target.photoUrls);
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
