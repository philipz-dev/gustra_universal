import { placeTypeDisplayName, sortedPlaceTypes } from '@/constants/PlaceTypeLabels';
import type { RestaurantVisitSummary } from '@/data/types';
import { i18n } from '@/i18n';

/** Combinable feed filters. Empty = “None” (Swift `FeedFilterFlag`). */
export type FeedFilterFlag =
  | 'favorites'
  | 'location'
  | 'placeType'
  /** Include imported/friend reviews (additive to own). */
  | 'friends';

/** Swift `FeedSortKind`. */
export type FeedSortKind =
  | { type: 'date' }
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
  sortKind: { type: 'date' },
  locationCities: [],
  primaryTypes: [],
};

/** Flags that affect restaurant matching (not map friend-pin inclusion). */
const RESTAURANT_FILTER_FLAGS: FeedFilterFlag[] = [
  'favorites',
  'location',
  'placeType',
];

export function isFeedFilterActive(state: FeedFilterState): boolean {
  return (
    state.filters.length > 0 || state.sortKind.type !== 'date'
  );
}

export function hasFeedFilter(
  state: Pick<FeedFilterState, 'filters'>,
  flag: FeedFilterFlag,
): boolean {
  return state.filters.includes(flag);
}

/** Merge restaurant visit summaries by restaurant id (own + friends on My map). */
export function mergeSummariesByRestaurant(
  lists: RestaurantVisitSummary[][],
): RestaurantVisitSummary[] {
  const byId = new Map<string, RestaurantVisitSummary>();
  for (const list of lists) {
    for (const summary of list) {
      const existing = byId.get(summary.restaurantId);
      if (!existing) {
        byId.set(summary.restaurantId, summary);
        continue;
      }
      const reviewIds = [
        ...new Set([...existing.reviewIds, ...summary.reviewIds]),
      ];
      const preferNewer = summary.lastVisitAt >= existing.lastVisitAt;
      const photoUrl =
        preferNewer && summary.photoUrl
          ? summary.photoUrl
          : existing.photoUrl || summary.photoUrl || '';
      byId.set(summary.restaurantId, {
        ...existing,
        ...(preferNewer ? summary : {}),
        reviewIds,
        visitCount: reviewIds.length,
        averageScore:
          existing.isDraft && summary.isDraft
            ? 0
            : existing.isDraft
              ? summary.averageScore
              : summary.isDraft
                ? existing.averageScore
                : (existing.averageScore * existing.visitCount +
                    summary.averageScore * summary.visitCount) /
                  (existing.visitCount + summary.visitCount),
        // Own score stays the main score when merging own + friends:
        // the user's own average (and count) is preserved on the card; the
        // friends' average/count travel as separate context fields.
        ownScore:
          existing.ownScore ?? summary.ownScore ?? undefined,
        ownVisitCount:
          existing.ownVisitCount ?? summary.ownVisitCount ?? undefined,
        ownReviewIds:
          existing.ownReviewIds ?? summary.ownReviewIds ?? undefined,
        friendScore:
          existing.friendScore ?? summary.friendScore ?? undefined,
        friendVisitCount:
          existing.friendVisitCount ?? summary.friendVisitCount ?? undefined,
        isFavorite: existing.isFavorite || summary.isFavorite,
        isDraft: Boolean(existing.isDraft) && Boolean(summary.isDraft),
        draftReviewId:
          Boolean(existing.isDraft) && Boolean(summary.isDraft)
            ? preferNewer
              ? summary.draftReviewId || existing.draftReviewId
              : existing.draftReviewId || summary.draftReviewId
            : undefined,
        lastVisitAt: Math.max(existing.lastVisitAt, summary.lastVisitAt),
        lastVisitDate:
          existing.lastVisitAt >= summary.lastVisitAt
            ? existing.lastVisitDate
            : summary.lastVisitDate,
        photoUrl,
        reviewerName: preferNewer
          ? summary.reviewerName || existing.reviewerName
          : existing.reviewerName || summary.reviewerName,
      });
    }
  }
  return [...byId.values()];
}

/** Drop the map-only `friends` flag before restaurant matching. */
export function restaurantFilterState(
  state: FeedFilterState,
): FeedFilterState {
  return {
    ...state,
    filters: state.filters.filter((flag) =>
      RESTAURANT_FILTER_FLAGS.includes(flag),
    ),
  };
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
  if (isAllSelection(selected, allItems)) return i18n.t('filters.all');
  return allItems
    .filter((item) => selected.includes(item))
    .map(titleForItem)
    .join(', ');
}

export function sortKindTitle(
  sortKind: FeedSortKind,
  criterionTitleFor?: (criterionId: string) => string,
): string {
  if (sortKind.type === 'date') return i18n.t('filters.sort.date');
  if (sortKind.type === 'averageScore') return i18n.t('filters.sort.averageScore');
  return criterionTitleFor?.(sortKind.criterionId) ?? i18n.t('filters.sort.criterion');
}

export function placeTypeSelectionSummary(
  selected: string[],
  allItems: string[],
): string {
  return selectionSummary(selected, allItems, placeTypeDisplayName);
}

function rankByDate(
  summaries: RestaurantVisitSummary[],
): RestaurantVisitSummary[] {
  return [...summaries].sort((a, b) => {
    const aDraft = a.isDraft ? 1 : 0;
    const bDraft = b.isDraft ? 1 : 0;
    if (aDraft !== bDraft) return bDraft - aDraft;
    if (a.lastVisitAt !== b.lastVisitAt) return b.lastVisitAt - a.lastVisitAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function rankByAverageScore(
  summaries: RestaurantVisitSummary[],
): RestaurantVisitSummary[] {
  return [...summaries].sort((a, b) => {
    const aDraft = a.isDraft ? 1 : 0;
    const bDraft = b.isDraft ? 1 : 0;
    if (aDraft !== bDraft) return bDraft - aDraft;
    // Own headline score first; combined average only as a tiebreak.
    const aScore = a.ownScore ?? a.averageScore;
    const bScore = b.ownScore ?? b.averageScore;
    if (aScore !== bScore) return bScore - aScore;
    if (a.averageScore !== b.averageScore) {
      return b.averageScore - a.averageScore;
    }
    if (a.lastVisitAt !== b.lastVisitAt) return b.lastVisitAt - a.lastVisitAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function rankByCriterion(
  summaries: RestaurantVisitSummary[],
  criterionId: string,
  criterionAverageFor: NonNullable<FeedFilterOptions['criterionAverageFor']>,
): RestaurantVisitSummary[] {
  const drafts = summaries.filter((s) => s.isDraft);
  const withScores = summaries
    .filter((s) => !s.isDraft)
    .map((summary) => ({
      summary,
      score: criterionAverageFor(summary, criterionId),
    }))
    .filter(
      (row): row is { summary: RestaurantVisitSummary; score: number } =>
        row.score != null,
    );

  const ranked = withScores
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.summary.name.localeCompare(b.summary.name, undefined, {
        sensitivity: 'base',
      });
    })
    .map((row) => row.summary);

  // Drafts stay on top even when sorting by criterion.
  return [
    ...rankByDate(drafts),
    ...ranked,
  ];
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
  const restaurantState = restaurantFilterState(state);

  if (hasFeedFilter(restaurantState, 'favorites')) {
    next = next.filter((summary) => summary.isFavorite);
  }

  if (hasFeedFilter(restaurantState, 'location')) {
    if (restaurantState.locationCities.length === 0) {
      next = [];
    } else {
      const cities = new Set(restaurantState.locationCities);
      next = next.filter((summary) => cities.has(summary.city.trim()));
    }
  }

  if (hasFeedFilter(restaurantState, 'placeType')) {
    if (restaurantState.primaryTypes.length === 0) {
      next = [];
    } else {
      const types = new Set(restaurantState.primaryTypes);
      next = next.filter((summary) =>
        types.has((summary.primaryType ?? '').trim()),
      );
    }
  }

  if (
    restaurantState.sortKind.type === 'criterion' &&
    options.criterionAverageFor
  ) {
    next = rankByCriterion(
      next,
      restaurantState.sortKind.criterionId,
      options.criterionAverageFor,
    );
  } else if (restaurantState.sortKind.type === 'averageScore') {
    next = rankByAverageScore(next);
  } else {
    // Default: most recent visit first.
    next = rankByDate(next);
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
