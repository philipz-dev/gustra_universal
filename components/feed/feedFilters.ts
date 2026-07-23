import { placeTypeDisplayName, sortedPlaceTypes } from '@/constants/PlaceTypeLabels';
import type { RestaurantVisitSummary } from '@/data/types';

/** Combinable feed filters. Empty = “None” (Swift `FeedFilterFlag`). */
export type FeedFilterFlag = 'favorites' | 'location' | 'placeType';

/** Swift `FeedSortKind`. */
export type FeedSortKind =
  | { type: 'averageScore' }
  | { type: 'criterion'; criterionId: string };

export type FeedFilterState = {
  filters: FeedFilterFlag[];
  sortKind: FeedSortKind;
  locationCities: string[];
  primaryTypes: string[];
};

export type FeedFilterOptions = {
  /** Average star rating for a criterion across a restaurant’s visits, or null if none. */
  criterionAverageFor?: (
    summary: RestaurantVisitSummary,
    criterionId: string,
  ) => number | null;
  criterionTitleFor?: (criterionId: string) => string;
};

export const DEFAULT_FEED_FILTER_STATE: FeedFilterState = {
  filters: [],
  sortKind: { type: 'averageScore' },
  locationCities: [],
  primaryTypes: [],
};

export function isFeedFilterActive(state: FeedFilterState): boolean {
  return (
    state.filters.length > 0 || state.sortKind.type !== 'averageScore'
  );
}

export function hasFeedFilter(
  state: Pick<FeedFilterState, 'filters'>,
  flag: FeedFilterFlag,
): boolean {
  return state.filters.includes(flag);
}

export function availableCitiesFromSummaries(
  summaries: RestaurantVisitSummary[],
): string[] {
  const cities = new Set<string>();
  for (const summary of summaries) {
    const city = summary.city.trim();
    if (city) cities.add(city);
  }
  return [...cities].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function availablePrimaryTypesFromSummaries(
  summaries: RestaurantVisitSummary[],
): string[] {
  const types = new Set<string>();
  for (const summary of summaries) {
    const type = (summary.primaryType ?? '').trim();
    if (type) types.add(type);
  }
  return sortedPlaceTypes([...types]);
}

export function isAllSelection(
  selected: string[],
  allItems: string[],
): boolean {
  return (
    selected.length === 0 ||
    (allItems.length > 0 && selected.length === allItems.length)
  );
}

export function selectionSummary(
  selected: string[],
  allItems: string[],
  titleForItem: (item: string) => string = (item) => item,
): string {
  if (isAllSelection(selected, allItems)) return 'All';
  return allItems
    .filter((item) => selected.includes(item))
    .map(titleForItem)
    .join(', ');
}

export function sortKindTitle(
  sortKind: FeedSortKind,
  criterionTitleFor?: (criterionId: string) => string,
): string {
  if (sortKind.type === 'averageScore') return 'Average score';
  return criterionTitleFor?.(sortKind.criterionId) ?? 'Criterion';
}

export function placeTypeSelectionSummary(
  selected: string[],
  allItems: string[],
): string {
  return selectionSummary(selected, allItems, placeTypeDisplayName);
}

function rankByAverageScore(
  summaries: RestaurantVisitSummary[],
): RestaurantVisitSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.averageScore !== b.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function rankByCriterion(
  summaries: RestaurantVisitSummary[],
  criterionId: string,
  criterionAverageFor: NonNullable<FeedFilterOptions['criterionAverageFor']>,
): RestaurantVisitSummary[] {
  const withScores = summaries
    .map((summary) => ({
      summary,
      score: criterionAverageFor(summary, criterionId),
    }))
    .filter(
      (row): row is { summary: RestaurantVisitSummary; score: number } =>
        row.score != null,
    );

  return withScores
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.summary.name.localeCompare(b.summary.name, undefined, {
        sensitivity: 'base',
      });
    })
    .map((row) => row.summary);
}

/**
 * Apply filter/sort options to restaurant summaries (Swift feed pipeline).
 * Text search stays separate and runs after this.
 */
export function applyFeedFilters(
  summaries: RestaurantVisitSummary[],
  state: FeedFilterState,
  options: FeedFilterOptions = {},
): RestaurantVisitSummary[] {
  let next = summaries;

  if (hasFeedFilter(state, 'favorites')) {
    next = next.filter((summary) => summary.isFavorite);
  }

  if (hasFeedFilter(state, 'location')) {
    if (state.locationCities.length === 0) {
      next = [];
    } else {
      const cities = new Set(state.locationCities);
      next = next.filter((summary) => cities.has(summary.city.trim()));
    }
  }

  if (hasFeedFilter(state, 'placeType')) {
    if (state.primaryTypes.length === 0) {
      next = [];
    } else {
      const types = new Set(state.primaryTypes);
      next = next.filter((summary) =>
        types.has((summary.primaryType ?? '').trim()),
      );
    }
  }

  if (state.sortKind.type === 'criterion' && options.criterionAverageFor) {
    next = rankByCriterion(
      next,
      state.sortKind.criterionId,
      options.criterionAverageFor,
    );
  } else {
    // Swift: averageScore sort always applies (including when no filter flags).
    next = rankByAverageScore(next);
  }

  return next;
}

/**
 * Drop location/cuisine selections that no longer exist after My ↔ Friends switch
 * (Swift `syncFiltersForReviewSourceChange`).
 */
export function pruneFeedFiltersForSummaries(
  state: FeedFilterState,
  summaries: RestaurantVisitSummary[],
): FeedFilterState {
  const cities = new Set(availableCitiesFromSummaries(summaries));
  const types = new Set(availablePrimaryTypesFromSummaries(summaries));
  let filters = [...state.filters];
  let locationCities = state.locationCities.filter((c) => cities.has(c));
  let primaryTypes = state.primaryTypes.filter((t) => types.has(t));

  if (hasFeedFilter(state, 'location') && locationCities.length === 0) {
    filters = filters.filter((f) => f !== 'location');
  }
  if (hasFeedFilter(state, 'placeType') && primaryTypes.length === 0) {
    filters = filters.filter((f) => f !== 'placeType');
  }

  return {
    ...state,
    filters,
    locationCities,
    primaryTypes,
  };
}

export function feedFilterPreviewCount(
  summaries: RestaurantVisitSummary[],
  state: FeedFilterState,
  options: FeedFilterOptions = {},
): number {
  return applyFeedFilters(summaries, state, options).length;
}
