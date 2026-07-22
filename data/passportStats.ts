import type { Restaurant, Review } from '@/data/types';

export type BestRestaurantEntry = {
  restaurantId: string;
  title: string;
  reviewId: string;
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
  bestScore: number | null;
  bestRestaurants: BestRestaurantEntry[];
  criterionAverages: CriterionAverage[];
  cityAverages: CityAverage[];
};

export type EnabledCriterion = { id: string; title: string };

function displayLocation(name: string, city: string): string {
  if (city.trim()) return `${name}, ${city}`;
  return name;
}

function scoreForEnabled(review: Review, enabledIds: Set<string>): number {
  const values = review.criteria
    .filter((c) => enabledIds.has(c.id) && c.rating > 0)
    .map((c) => c.rating);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
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
        .filter((rating) => rating > 0);
      if (values.length === 0) return null;
      return {
        id: criterion.id,
        title: criterion.title,
        average: values.reduce((a, b) => a + b, 0) / values.length,
      };
    })
    .filter((row): row is CriterionAverage => row !== null);
}

/** Personal passport stats (Swift CulinaryPassportView). */
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
      bestScore: null,
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

  const topScore = Math.max(...scored.map((r) => r.score));
  const bestScore = topScore > 0 ? topScore : null;
  const topRounded = bestScore != null ? Math.round(bestScore * 10) / 10 : null;

  const newestByRestaurant = new Map<string, Review>();
  if (topRounded != null) {
    for (const { review, score } of scored) {
      if (Math.round(score * 10) / 10 !== topRounded) continue;
      if (!newestByRestaurant.has(review.restaurantId)) {
        newestByRestaurant.set(review.restaurantId, review);
      }
    }
  }

  const bestRestaurants: BestRestaurantEntry[] = Array.from(
    newestByRestaurant.values(),
  )
    .map((review) => {
      const restaurant = restaurantById.get(review.restaurantId);
      if (!restaurant) return null;
      return {
        restaurantId: restaurant.id,
        title: displayLocation(restaurant.name, restaurant.city),
        reviewId: review.id,
      };
    })
    .filter((e): e is BestRestaurantEntry => e !== null)
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    );

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
    .sort((a, b) => b.average - a.average);

  return {
    totalReviews,
    averageOverall,
    bestScore: topRounded,
    bestRestaurants,
    criterionAverages: criterionAveragesFromReviews(reviews, enabledCriteria),
    cityAverages,
  };
}
