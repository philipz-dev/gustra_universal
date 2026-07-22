import type { CustomCriterionDefinition } from '@/context/CriteriaSettings';
import type { Restaurant, Review, ReviewOrigin } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
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

function countryFromAddress(address: string, city: string): string {
  // Mock data has no country field — leave empty for Swift compatibility.
  void address;
  void city;
  return '';
}

export function restaurantToBackup(restaurant: Restaurant): RestaurantBackup {
  return {
    id: restaurant.id,
    name: restaurant.name,
    city: restaurant.city,
    country: countryFromAddress(restaurant.address, restaurant.city),
    streetAddress: restaurant.address || null,
    phoneNumber: restaurant.phone ?? null,
    latitude: 0,
    longitude: 0,
    mapItemIdentifier: null,
    isFavorite: restaurant.isFavorite,
    primaryType: null,
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

  // Remote Unsplash URLs are not local photo filenames — omit from photoPaths.
  const photoPaths = review.photoUrls.filter(
    (p) => !p.startsWith('http://') && !p.startsWith('https://'),
  );

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
    reviewedByPhotoPath: null,
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
    address: item.streetAddress ?? previous?.address ?? '',
    phone: item.phoneNumber ?? previous?.phone,
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

  const rated = criteria.filter((c) => c.rating > 0).map((c) => c.rating);
  const overallScore =
    rated.length > 0
      ? rated.reduce((a, b) => a + b, 0) / rated.length
      : previous?.overallScore ?? 0;

  const localPhotos = item.photoPaths ?? [];
  const photoUrls =
    localPhotos.length > 0
      ? localPhotos
      : previous?.photoUrls?.length
        ? previous.photoUrls
        : [];

  return {
    id: item.id,
    restaurantId: item.restaurantID ?? previous?.restaurantId ?? '',
    date: fromAppleRefDate(item.date),
    generalComment: item.generalComment ?? '',
    criteria,
    photoUrls,
    reviewedBy: item.reviewedBy ?? previous?.reviewedBy ?? '',
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
