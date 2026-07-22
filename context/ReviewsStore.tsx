import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { mockRestaurants, mockReviews } from '@/data/mockReviews';
import type {
  Restaurant,
  RestaurantVisitSummary,
  Review,
  ReviewOrigin,
} from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
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

const STORAGE_KEY = 'gustraReviewsStore.v2';

type StoredShape = {
  restaurants: Restaurant[];
  reviews: Review[];
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
  createEncryptedBackup: (password: string) => Promise<Uint8Array>;
  importEncryptedBackup: (
    data: Uint8Array,
    password: string,
    mode: BackupImportMode,
  ) => Promise<void>;
};

const ReviewsStoreContext = createContext<ReviewsStoreValue | null>(null);

function formatAbbreviated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeReview(review: Review): Review {
  return { ...review, origin: resolveReviewOrigin(review) };
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredShape;
          if (
            !cancelled &&
            Array.isArray(parsed.restaurants) &&
            Array.isArray(parsed.reviews)
          ) {
            const normalized = parsed.reviews.map((r) =>
              normalizeReview(r as Review),
            );
            setRestaurants(parsed.restaurants);
            setReviews(normalized);
            await persist({
              restaurants: parsed.restaurants,
              reviews: normalized,
            });
            return;
          }
        }
        if (!cancelled) {
          setRestaurants(mockRestaurants);
          setReviews(mockReviews);
          await persist({
            restaurants: mockRestaurants,
            reviews: mockReviews,
          });
        }
      } catch {
        if (!cancelled) {
          setRestaurants(mockRestaurants);
          setReviews(mockReviews);
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
      const next = applyBackupPayload({
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
