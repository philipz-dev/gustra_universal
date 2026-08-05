import type { Restaurant, Review, WineLabelFiche } from '@/data/types';
import { isReviewDraft } from '@/services/reviews/draftReview';
import { wineLabelsForReview } from '@/services/wine/wineLabelTypes';
import type { TimeMachineEntry } from '@/data/timeMachine';
import {
  RatingValue,
  overallScoreFromCriteria,
} from '@/services/reviews/ratings';

export type BestRestaurantEntry = {
  restaurantId: string;
  title: string;
  reviewId: string;
  average: number;
  /** Hero/feed photo for the #1 podium card (additive—optional for safety). */
  photoUrl?: string;
  /** Fallback tile color when no photo (additive—optional for safety). */
  thumbnailColor?: string;
};

/** A top bottle: name + its user star rating (half-star 1…10). */
export type BestWineEntry = {
  fiche: WineLabelFiche;
  reviewId: string;
  /** Half-star steps 1…10 (use `RatingValue.starValue` → 0.5…5.0). */
  rating: number;
};

export type CityAverage = {
  city: string;
  average: number;
};

export type PassportStats = {
  totalReviews: number;
  averageOverall: number;
  bestRestaurants: BestRestaurantEntry[];
  cityAverages: CityAverage[];
};

/** Per-year rollup for the Time Travel overview. */
export type TimeTravelYearStats = {
  year: number;
  totalReviews: number;
  averageScore: number;
};

export type TimeTravelStats = {
  years: TimeTravelYearStats[];
  totalAllTime: number;
  averageAllTime: number;
};

const TOP_N = 3;
function displayLocation(name: string, city: string): string {
  if (city.trim()) return `${name}, ${city}`;
  return name;
}

/**
 * Passport score for one review: the average of ALL rated criteria —
 * exactly the same rule as the feed and the restaurant detail screen.
 * Enabled-criteria filtering must not change the headline score.
 */
function scoreForReview(review: Review): number {
  return overallScoreFromCriteria(review.criteria);
}

/** Passport stats over the (already filtered) review set. */
export function getPassportStats(
  sourceReviews: Review[],
  restaurants: Restaurant[],
): PassportStats {
  const restaurantById = new Map(restaurants.map((r) => [r.id, r]));
  // Drafts (no criterion stars, or unrated wines) do not count toward passport.
  const reviews = sourceReviews
    .filter((r) => !isReviewDraft(r))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const totalReviews = reviews.length;

  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageOverall: 0,
      bestRestaurants: [],
      cityAverages: [],
    };
  }

  const scored = reviews.map((review) => ({
    review,
    score: scoreForReview(review),
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
    .map(
      (
        [restaurantId, bucket]: [
          string,
          { scores: number[]; newestReviewId: string; newestAt: number },
        ],
      ): BestRestaurantEntry | null => {
        const restaurant = restaurantById.get(restaurantId);
        if (!restaurant) return null;
        const average =
          bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length;
        return {
          restaurantId,
          title: displayLocation(restaurant.name, restaurant.city),
          reviewId: bucket.newestReviewId,
          average,
          // Additive: feed/detail photo so the #1 podium can show a hero image.
          photoUrl: restaurant.photoUrl?.trim() ? restaurant.photoUrl : undefined,
          thumbnailColor: restaurant.thumbnailColor || undefined,
        };
      },
    )
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
    cityAverages,
  };
}

/**
 * Per-year rollups over the Time Travel timeline (newest year first).
 * Entries are already filtered (non-draft, own + imported) and sorted
 * newest-first by buildTimeMachineEntries.
 */
export function getTimeTravelStats(
  entries: TimeMachineEntry[],
): TimeTravelStats {
  if (entries.length === 0) {
    return { years: [], totalAllTime: 0, averageAllTime: 0 };
  }

  const yearBuckets = new Map<number, number[]>();
  for (const entry of entries) {
    const year = new Date(entry.date).getFullYear();
    if (!Number.isFinite(year)) continue;
    const list = yearBuckets.get(year) ?? [];
    list.push(entry.score);
    yearBuckets.set(year, list);
  }

  const years = Array.from(yearBuckets.entries())
    .map(([year, scores]) => ({
      year,
      totalReviews: scores.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => b.year - a.year);

  const totalAllTime = years.reduce((sum, y) => sum + y.totalReviews, 0);
  const averageAllTime =
    totalAllTime === 0
      ? 0
      : years.reduce((sum, y) => sum + y.averageScore * y.totalReviews, 0) /
        totalAllTime;

  return { years, totalAllTime, averageAllTime };
}

const TOP_WINES = 3;

/**
 * Top bottles by their own user rating (half-star 1…10), across the filtered
 * review set. Not an average per review — each rated bottle is ranked
 * individually. Sorted best first, then by newest review date as a tiebreaker.
 * Empty when no bottle has been star-rated (UI hides the section entirely).
 */
export function getBestWines(sourceReviews: Review[]): BestWineEntry[] {
  const candidates: BestWineEntry[] = [];

  for (const review of sourceReviews) {
    if (isReviewDraft(review)) continue;
    for (const fiche of wineLabelsForReview(review)) {
      const rating = fiche.userRating ?? RatingValue.unrated;
      if (!RatingValue.isStarRating(rating)) continue;
      candidates.push({ fiche, reviewId: review.id, rating });
    }
  }

  return candidates
    .sort((a, b) => b.rating - a.rating)
    .slice(0, TOP_WINES);
}
