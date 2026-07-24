import type { Restaurant, Review } from '@/data/types';
import {
  RatingValue,
  overallScoreFromCriteria,
} from '@/services/reviews/ratings';

export type BestRestaurantEntry = {
  restaurantId: string;
  title: string;
  reviewId: string;
  average: number;
};

export type CriterionAverage = {
  id: string;
  title: string;
  average: number;
};

export type CityAverage = {
  city: string;
  average: number;
};

export type PassportStats = {
  totalReviews: number;
  averageOverall: number;
  bestRestaurants: BestRestaurantEntry[];
  criterionAverages: CriterionAverage[];
  cityAverages: CityAverage[];
};

export type EnabledCriterion = { id: string; title: string };

const TOP_N = 3;

function displayLocation(name: string, city: string): string {
  if (city.trim()) return `${name}, ${city}`;
  return name;
}

function scoreForEnabled(review: Review, enabledIds: Set<string>): number {
  return overallScoreFromCriteria(
    review.criteria.filter((c) => enabledIds.has(c.id)),
  );
}

function criterionAveragesFromReviews(
  reviews: Review[],
  enabled: EnabledCriterion[],
): CriterionAverage[] {
  return enabled
    .map((criterion) => {
      const values = reviews
        .map(
          (r) => r.criteria.find((c) => c.id === criterion.id)?.rating ?? 0,
        )
        .filter((rating) => RatingValue.isStarRating(rating))
        .map((rating) => RatingValue.starValue(rating));
      if (values.length === 0) return null;
      return {
        id: criterion.id,
        title: criterion.title,
        average: values.reduce((a, b) => a + b, 0) / values.length,
      };
    })
    .filter((row): row is CriterionAverage => row !== null);
}

/** Passport stats over the (already filtered) review set. */
export function getPassportStats(
  enabledCriteria: EnabledCriterion[],
  sourceReviews: Review[],
  restaurants: Restaurant[],
): PassportStats {
  const enabledIds = new Set(enabledCriteria.map((c) => c.id));
  const restaurantById = new Map(restaurants.map((r) => [r.id, r]));
  const reviews = [...sourceReviews].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
  const totalReviews = reviews.length;

  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageOverall: 0,
      bestRestaurants: [],
      criterionAverages: [],
      cityAverages: [],
    };
  }

  const scored = reviews.map((review) => ({
    review,
    score: scoreForEnabled(review, enabledIds),
  }));

  const averageOverall =
    scored.reduce((sum, r) => sum + r.score, 0) / scored.length;

  // Per-restaurant averages → top 3 (same ranking style as cities).
  const restaurantBuckets = new Map<
    string,
    { scores: number[]; newestReviewId: string; newestAt: number }
  >();
  for (const { review, score } of scored) {
    const at = +new Date(review.date);
    const existing = restaurantBuckets.get(review.restaurantId);
    if (!existing) {
      restaurantBuckets.set(review.restaurantId, {
        scores: [score],
        newestReviewId: review.id,
        newestAt: at,
      });
      continue;
    }
    existing.scores.push(score);
    if (at > existing.newestAt) {
      existing.newestAt = at;
      existing.newestReviewId = review.id;
    }
  }

  const bestRestaurants: BestRestaurantEntry[] = Array.from(
    restaurantBuckets.entries(),
  )
    .map(([restaurantId, bucket]) => {
      const restaurant = restaurantById.get(restaurantId);
      if (!restaurant) return null;
      const average =
        bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length;
      return {
        restaurantId,
        title: displayLocation(restaurant.name, restaurant.city),
        reviewId: bucket.newestReviewId,
        average,
      };
    })
    .filter((e): e is BestRestaurantEntry => e !== null)
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    })
    .slice(0, TOP_N);

  const cityBuckets = new Map<string, number[]>();
  for (const { review, score } of scored) {
    const restaurant = restaurantById.get(review.restaurantId);
    const city = restaurant?.city?.trim();
    if (!city) continue;
    const list = cityBuckets.get(city) ?? [];
    list.push(score);
    cityBuckets.set(city, list);
  }

  const cityAverages: CityAverage[] = Array.from(cityBuckets.entries())
    .map(([city, scores]) => ({
      city,
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      return a.city.localeCompare(b.city, undefined, { sensitivity: 'base' });
    })
    .slice(0, TOP_N);

  return {
    totalReviews,
    averageOverall,
    bestRestaurants,
    criterionAverages: criterionAveragesFromReviews(reviews, enabledCriteria),
    cityAverages,
  };
}
