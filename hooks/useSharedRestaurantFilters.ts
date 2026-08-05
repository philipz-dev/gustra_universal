import { useCallback, useEffect, useMemo } from 'react';

import {
  applyFeedFilters,
  availableCitiesFromSummaries,
  availablePrimaryTypesFromSummaries,
  hasFeedFilter,
  isFeedFilterActive,
  mergeSummariesByRestaurant,
  type FeedFilterOptions,
} from '@/components/feed/feedFilters';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useFeedFilter } from '@/context/FeedFilterContext';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { RestaurantVisitSummary, Review } from '@/data/types';
import { isReviewDraft } from '@/services/reviews/draftReview';

/**
 * Shared Reviews / My map / My Gustra filter pipeline:
 * own summaries, optionally merged with friends when “Include friend's reviews” is on.
 */
export function useSharedRestaurantFilters() {
  const { filterState, setFilterState, resetFilterState } = useFeedFilter();
  const { getFeedSummaries, getReview, ready, hasFriendReviews } =
    useReviewsStore();
  const { enabledCriteria } = useCriteriaSettings();

  // Drop friends flag when there are no imported reviews left.
  useEffect(() => {
    if (hasFriendReviews || !hasFeedFilter(filterState, 'friends')) return;
    setFilterState((prev) => ({
      ...prev,
      filters: prev.filters.filter((flag) => flag !== 'friends'),
    }));
  }, [filterState, hasFriendReviews, setFilterState]);

  const includeFriends =
    hasFriendReviews && hasFeedFilter(filterState, 'friends');

  const ownSummaries = useMemo(
    () => (ready ? getFeedSummaries('own') : []),
    [getFeedSummaries, ready],
  );

  const friendSummaries = useMemo(
    () => (ready && hasFriendReviews ? getFeedSummaries('imported') : []),
    [getFeedSummaries, hasFriendReviews, ready],
  );

  const sourceSummaries = useMemo(
    () =>
      includeFriends
        ? mergeSummariesByRestaurant([ownSummaries, friendSummaries])
        : ownSummaries,
    [friendSummaries, includeFriends, ownSummaries],
  );

  const availableCities = useMemo(
    () => availableCitiesFromSummaries(sourceSummaries),
    [sourceSummaries],
  );

  const availablePrimaryTypes = useMemo(
    () => availablePrimaryTypesFromSummaries(sourceSummaries),
    [sourceSummaries],
  );

  const sortCriteria = useMemo(() => {
    const food = enabledCriteria.filter((c) => c.id === 'food');
    const rest = enabledCriteria
      .filter((c) => c.id !== 'food')
      .slice()
      .sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
    return [...food, ...rest];
  }, [enabledCriteria]);

  const criterionAverageFor = useCallback(
    (summary: RestaurantVisitSummary, criterionId: string) => {
      // Use the owner's own reviews only, so a friend's visit never drags the
      // criterion score shown next to the owner's headline score.
      const ids = summary.ownReviewIds ?? summary.reviewIds;
      const values = ids
        .map((id) => getReview(id))
        .filter((review): review is Review => Boolean(review))
        .filter((review) => !isReviewDraft(review))
        .map(
          (review) =>
            review.criteria.find((c) => c.id === criterionId)?.rating ?? 0,
        )
        .filter((rating) => rating >= 1 && rating <= 10)
        .map((rating) => rating / 2);
      if (values.length === 0) return null;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    },
    [getReview],
  );

  const criterionTitleFor = useCallback(
    (criterionId: string) =>
      enabledCriteria.find((c) => c.id === criterionId)?.title ?? criterionId,
    [enabledCriteria],
  );

  const filterOptions = useMemo<FeedFilterOptions>(
    () => ({ criterionAverageFor, criterionTitleFor }),
    [criterionAverageFor, criterionTitleFor],
  );

  const filteredSummaries = useMemo(
    () => applyFeedFilters(sourceSummaries, filterState, filterOptions),
    [filterOptions, filterState, sourceSummaries],
  );

  const filterActive = isFeedFilterActive(filterState);
  const canFilter = ownSummaries.length > 0 || hasFriendReviews;

  return {
    filterState,
    setFilterState,
    resetFilterState,
    ownSummaries,
    friendSummaries,
    sourceSummaries,
    filteredSummaries,
    availableCities,
    availablePrimaryTypes,
    sortCriteria,
    filterOptions,
    criterionAverageFor,
    criterionTitleFor,
    filterActive,
    canFilter,
    includeFriends,
    showFriendsFilter: hasFriendReviews,
    ready,
  };
}
