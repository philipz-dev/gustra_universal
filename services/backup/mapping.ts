import type { CustomCriterionDefinition } from '@/context/CriteriaSettings';
import type { Restaurant, Review, ReviewOrigin } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import {
  backupPhotoKey,
  isRemotePhotoUrl,
  localPhotoUri,
} from '@/services/backup/photos';
import {
  fromAppleRefDate,
  toAppleRefDate,
  type BackupPayload,
  type CriteriaSettingsBackup,
  type RestaurantBackup,
  type ReviewBackup,
  type ReviewerProfileBackup,
  REVIEWER_PHOTO_BACKUP_KEY,
} from '@/services/backup/types';

function originFromBackup(
  item: ReviewBackup,
  previous?: Review,
): ReviewOrigin {
  if (item.origin === 'own' || item.origin === 'imported') {
    return item.origin;
  }
  return resolveReviewOrigin({
    origin: previous?.origin as ReviewOrigin,
    reviewedBy: item.reviewedBy ?? previous?.reviewedBy ?? '',
  });
}

function criterion(
  review: Review,
  id: string,
): { rating: number; comment: string } {
  const found = review.criteria.find((c) => c.id === id);
  return { rating: found?.rating ?? 0, comment: found?.comment ?? '' };
}

export function restaurantToBackup(restaurant: Restaurant): RestaurantBackup {
  const primaryType = restaurant.primaryType.trim();
  const mapId = restaurant.mapItemIdentifier?.trim() || null;
  return {
    id: restaurant.id,
    name: restaurant.name,
    city: restaurant.city,
    country: restaurant.country.trim(),
    streetAddress: restaurant.address.trim() || null,
    phoneNumber: restaurant.phone?.trim() || null,
    latitude: Number.isFinite(restaurant.latitude) ? restaurant.latitude : 0,
    longitude: Number.isFinite(restaurant.longitude) ? restaurant.longitude : 0,
    mapItemIdentifier: mapId,
    isFavorite: restaurant.isFavorite,
    // Absent/empty in older backups — omit empty so Swift stays compatible.
    primaryType: primaryType.length > 0 ? primaryType : null,
  };
}

export function reviewToBackup(review: Review): ReviewBackup {
  const food = criterion(review, 'food');
  const drinks = criterion(review, 'drinks');
  const service = criterion(review, 'service');
  const setting = criterion(review, 'setting');
  const value = criterion(review, 'valueForMoney');

  const custom = review.criteria.filter(
    (c) =>
      !['food', 'drinks', 'service', 'setting', 'valueForMoney'].includes(c.id),
  );
  let customCriterionScoresJSON: string | null = null;
  if (custom.length > 0) {
    const ratings: Record<string, number> = {};
    const comments: Record<string, string> = {};
    for (const c of custom) {
      ratings[c.id] = c.rating;
      if (c.comment) comments[c.id] = c.comment;
    }
    customCriterionScoresJSON = JSON.stringify({ ratings, comments });
  }

  // Local files only (Swift). Remote mock URLs are omitted from photoPaths.
  const photoPaths = review.photoUrls
    .filter((p) => !isRemotePhotoUrl(p))
    .map(backupPhotoKey)
    .filter(Boolean);

  const searchable = [
    review.generalComment,
    ...review.criteria.map((c) => c.comment),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: review.id,
    date: toAppleRefDate(review.date),
    restaurantID: review.restaurantId,
    foodRating: food.rating,
    drinksRating: drinks.rating,
    serviceRating: service.rating,
    settingRating: setting.rating,
    valueRating: value.rating,
    customRating: custom[0]?.rating ?? 0,
    customCriterionScoresJSON,
    foodComment: food.comment,
    drinksComment: drinks.comment,
    serviceComment: service.comment,
    settingComment: setting.comment,
    valueComment: value.comment,
    customComment: custom[0]?.comment ?? '',
    generalComment: review.generalComment,
    searchableText: searchable,
    photoPaths,
    isNeverAgain: false,
    reviewedBy: review.reviewedBy || null,
    reviewedByPhotoPath: review.reviewedByPhotoUrl
      ? backupPhotoKey(review.reviewedByPhotoUrl)
      : null,
    origin: resolveReviewOrigin(review),
  };
}

export function backupRestaurantToApp(
  item: RestaurantBackup,
  previous?: Restaurant,
): Restaurant {
  return {
    id: item.id,
    name: item.name,
    city: item.city,
    country: item.country || previous?.country || '',
    address: item.streetAddress ?? previous?.address ?? '',
    phone: item.phoneNumber ?? previous?.phone,
    latitude:
      typeof item.latitude === 'number' && Number.isFinite(item.latitude)
        ? item.latitude
        : (previous?.latitude ?? 0),
    longitude:
      typeof item.longitude === 'number' && Number.isFinite(item.longitude)
        ? item.longitude
        : (previous?.longitude ?? 0),
    mapItemIdentifier:
      item.mapItemIdentifier ?? previous?.mapItemIdentifier ?? null,
    primaryType:
      (item.primaryType ?? previous?.primaryType ?? '').trim(),
    isFavorite: item.isFavorite ?? previous?.isFavorite ?? false,
    thumbnailColor: previous?.thumbnailColor ?? '#3D6B52',
    photoUrl: previous?.photoUrl ?? '',
  };
}

function pushCriterion(
  list: Review['criteria'],
  id: string,
  title: string,
  rating: number,
  comment: string,
) {
  if (rating > 0 || comment) {
    list.push({ id, title, rating, comment });
  }
}

export function backupReviewToApp(
  item: ReviewBackup,
  previous?: Review,
): Review {
  const criteria: Review['criteria'] = [];
  pushCriterion(criteria, 'food', 'Food', item.foodRating, item.foodComment);
  pushCriterion(
    criteria,
    'drinks',
    'Drinks',
    item.drinksRating,
    item.drinksComment,
  );
  pushCriterion(
    criteria,
    'service',
    'Service',
    item.serviceRating,
    item.serviceComment,
  );
  pushCriterion(
    criteria,
    'setting',
    'Atmosphere',
    item.settingRating,
    item.settingComment,
  );
  pushCriterion(
    criteria,
    'valueForMoney',
    'Value for Money',
    item.valueRating,
    item.valueComment,
  );

  if (item.customCriterionScoresJSON) {
    try {
      const parsed = JSON.parse(item.customCriterionScoresJSON) as {
        ratings?: Record<string, number>;
        comments?: Record<string, string>;
      };
      for (const [id, rating] of Object.entries(parsed.ratings ?? {})) {
        criteria.push({
          id,
          title: 'Custom',
          rating,
          comment: parsed.comments?.[id] ?? '',
        });
      }
    } catch {
      // ignore malformed custom scores
    }
  }

  const rated = criteria
    .map((c) => c.rating)
    .filter((r) => r >= 1 && r <= 10)
    .map((r) => r / 2);
  const overallScore =
    rated.length > 0
      ? rated.reduce((a, b) => a + b, 0) / rated.length
      : previous?.overallScore ?? 0;

  const localPhotos = (item.photoPaths ?? [])
    .map((path) => path.trim())
    .filter(Boolean);
  // Restore local Photos/ URIs; keep previous remote mock URLs only when backup has no locals.
  const photoUrls =
    localPhotos.length > 0
      ? localPhotos.map((path) =>
          isRemotePhotoUrl(path) || path.startsWith('file://')
            ? path
            : localPhotoUri(backupPhotoKey(path)),
        )
      : previous?.photoUrls?.length
        ? previous.photoUrls
        : [];

  const reviewerPhotoRaw = (
    item.reviewedByPhotoPath ??
    previous?.reviewedByPhotoUrl ??
    ''
  ).trim();
  let reviewedByPhotoUrl: string | undefined;
  if (reviewerPhotoRaw) {
    reviewedByPhotoUrl =
      isRemotePhotoUrl(reviewerPhotoRaw) || reviewerPhotoRaw.startsWith('file://')
        ? reviewerPhotoRaw
        : localPhotoUri(backupPhotoKey(reviewerPhotoRaw));
  }

  return {
    id: item.id,
    restaurantId: item.restaurantID ?? previous?.restaurantId ?? '',
    date: fromAppleRefDate(item.date),
    generalComment: item.generalComment ?? '',
    criteria,
    photoUrls,
    reviewedBy: item.reviewedBy ?? previous?.reviewedBy ?? '',
    reviewedByPhotoUrl,
    overallScore,
    origin: originFromBackup(item, previous),
  };
}

export function buildPayloadFromApp(args: {
  restaurants: Restaurant[];
  reviews: Review[];
  appVersion: string;
  photoFiles?: Record<string, string>;
  reviewerProfile?: ReviewerProfileBackup | null;
  criteriaSettings?: CriteriaSettingsBackup | null;
}): BackupPayload {
  const restaurantsById = new Map<string, Restaurant>();
  for (const r of args.restaurants) restaurantsById.set(r.id, r);

  const usedRestaurants = new Map<string, RestaurantBackup>();
  const reviewBackups: ReviewBackup[] = [];

  for (const review of args.reviews) {
    reviewBackups.push(reviewToBackup(review));
    const restaurant = restaurantsById.get(review.restaurantId);
    if (restaurant && !usedRestaurants.has(restaurant.id)) {
      usedRestaurants.set(restaurant.id, restaurantToBackup(restaurant));
    }
  }

  return {
    schemaVersion: 1,
    appVersion: args.appVersion,
    exportedAt: toAppleRefDate(new Date()),
    restaurants: [...usedRestaurants.values()],
    reviews: reviewBackups,
    photoFiles: args.photoFiles ?? {},
    reviewerProfile: args.reviewerProfile ?? null,
    criteriaSettings: args.criteriaSettings ?? null,
  };
}

export function criteriaSettingsToBackup(args: {
  disabledStandardIds: Iterable<string>;
  customCriteria: CustomCriterionDefinition[];
}): CriteriaSettingsBackup {
  return {
    disabledStandardIds: [...args.disabledStandardIds],
    customCriteria: args.customCriteria.map((c) => ({
      id: c.id,
      name: c.name,
      isEnabled: c.isEnabled,
    })),
  };
}

export function reviewerProfileToBackup(args: {
  name: string;
  hasPhoto: boolean;
}): ReviewerProfileBackup {
  return {
    name: args.name.trim(),
    photoFileName: args.hasPhoto ? REVIEWER_PHOTO_BACKUP_KEY : null,
  };
}
