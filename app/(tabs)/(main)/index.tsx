import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveFilterSummary } from '@/components/feed/ActiveFilterSummary';
import { FilterOptionsModal } from '@/components/feed/FilterOptionsModal';
import { FilterSearchBar } from '@/components/feed/FilterSearchBar';
import {
  applyFeedFilters,
  availableCitiesFromSummaries,
  availablePrimaryTypesFromSummaries,
  DEFAULT_FEED_FILTER_STATE,
  isFeedFilterActive,
  pruneFeedFiltersForSummaries,
  type FeedFilterOptions,
  type FeedFilterState,
} from '@/components/feed/feedFilters';
import { dismissOpenSwipeable } from '@/components/feed/openSwipeable';
import { RestaurantFeedCard } from '@/components/feed/RestaurantFeedCard';
import { ReviewSourcePicker } from '@/components/feed/ReviewSourcePicker';
import { ShareReviewerNameModal } from '@/components/feed/ShareReviewerNameModal';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseFAB } from '@/components/ui/HouseFAB';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import {
  consumePendingFeedReviewSource,
  useShareImportLaunch,
} from '@/context/ShareImportLaunch';
import type {
  RestaurantVisitSummary,
  Review,
  ReviewOrigin,
} from '@/data/types';
import { shareReviewsPackage } from '@/services/share/ReviewShareService';

export default function ReviewsFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [reviewSource, setReviewSource] = useState<ReviewOrigin>('own');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterState, setFilterState] = useState<FeedFilterState>(
    DEFAULT_FEED_FILTER_STATE,
  );
  const [sharing, setSharing] = useState(false);
  /** One-shot: keep Friends selected until imported reviews appear in the store. */
  const [awaitingFriendsTab, setAwaitingFriendsTab] = useState(false);
  const {
    getFeedSummaries,
    getReview,
    restaurants,
    ready,
    hasFriendReviews,
    deleteRestaurantFromFeed,
    setRestaurantFavorite,
  } = useReviewsStore();
  const { hasName, updateName, getBackupSnapshot } = useReviewerProfile();
  const { pickSharePackage } = useShareImportLaunch();
  const { enabledCriteria } = useCriteriaSettings();

  // After share-import: select Friends' reviews when the feed gains focus.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingFeedReviewSource();
      if (!pending) return;
      setReviewSource(pending);
      if (pending === 'imported') setAwaitingFriendsTab(true);
    }, []),
  );

  useEffect(() => {
    if (awaitingFriendsTab && hasFriendReviews) {
      setReviewSource('imported');
      setAwaitingFriendsTab(false);
    }
  }, [awaitingFriendsTab, hasFriendReviews]);

  // Swift: hide Friends segment when there are no imported reviews.
  useEffect(() => {
    if (awaitingFriendsTab) return;
    if (!hasFriendReviews && reviewSource !== 'own') {
      setReviewSource('own');
    }
  }, [awaitingFriendsTab, hasFriendReviews, reviewSource]);

  const summaries = useMemo(
    () => (ready ? getFeedSummaries(reviewSource) : []),
    [getFeedSummaries, ready, reviewSource],
  );

  const availableCities = useMemo(
    () => availableCitiesFromSummaries(summaries),
    [summaries],
  );

  const availablePrimaryTypes = useMemo(
    () => availablePrimaryTypesFromSummaries(summaries),
    [summaries],
  );

  /** Food first (when enabled), then remaining criteria A–Z (Swift). */
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
      const values = summary.reviewIds
        .map((id) => getReview(id))
        .filter((review): review is Review => Boolean(review))
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

  const filterActive = isFeedFilterActive(filterState);
  const canFilter = summaries.length > 0;

  useEffect(() => {
    if (!canFilter) setFilterModalVisible(false);
  }, [canFilter]);

  const filtered = useMemo(() => {
    const afterFilters = applyFeedFilters(
      summaries,
      filterState,
      filterOptions,
    );
    const q = query.trim().toLowerCase();
    if (!q) return afterFilters;
    // Swift: searchableText (comments + OCR) OR restaurant name.
    return afterFilters.filter((summary) => {
      if (
        summary.name.toLowerCase().includes(q) ||
        summary.city.toLowerCase().includes(q)
      ) {
        return true;
      }
      return summary.reviewIds.some((id) => {
        const review = getReview(id);
        return (review?.searchableText ?? '').toLowerCase().includes(q);
      });
    });
  }, [filterOptions, filterState, getReview, query, summaries]);

  /** Visible feed rows → underlying reviews (Swift `filteredReviews`). */
  const reviewsToShare = useMemo(() => {
    const list: Review[] = [];
    for (const summary of filtered) {
      for (const id of summary.reviewIds) {
        const review = getReview(id);
        if (review) list.push(review);
      }
    }
    return list;
  }, [filtered, getReview]);

  const isFriends = reviewSource === 'imported';
  const canShare = !isFriends && reviewsToShare.length > 0 && !sharing;

  const performShare = useCallback(
    async (sharedByOverride?: string) => {
      if (reviewsToShare.length === 0) return;
      setSharing(true);
      try {
        const profile = await getBackupSnapshot();
        const sharedBy = (sharedByOverride ?? profile.name).trim();
        if (!sharedBy) {
          throw new Error('Your name is included when you share reviews.');
        }
        await shareReviewsPackage({
          reviews: reviewsToShare,
          restaurants,
          sharedBy,
          sharedByPhotoBase64: profile.photoBase64,
        });
      } catch (error) {
        houseAlert(
          'Error',
          error instanceof Error
            ? error.message
            : 'Could not prepare the shared reviews file.',
        );
      } finally {
        setSharing(false);
      }
    },
    [getBackupSnapshot, restaurants, reviewsToShare],
  );

  const openShare = useCallback(() => {
    if (!canShare) return;
    if (!hasName) {
      setNameModalVisible(true);
      return;
    }
    void performShare();
  }, [canShare, hasName, performShare]);

  const emptyFromFilters =
    summaries.length > 0 && filtered.length === 0 && (filterActive || query);
  const emptyTitle = emptyFromFilters
    ? filterState.sortKind.type === 'criterion' && !query
      ? 'No Matching Restaurants'
      : 'No matches'
    : isFriends
      ? 'No Friend Reviews'
      : 'No reviews yet';
  const emptyDescription = emptyFromFilters
    ? query
      ? 'Try another restaurant, city, comment, or text from a photo.'
      : filterState.sortKind.type === 'criterion'
        ? 'No restaurants have a rating for this criterion yet.'
        : 'No restaurants match the selected filters.'
    : isFriends
      ? "Import shared reviews to see friends' reviews here."
      : 'Start collecting food memories. Your first review will appear here.';

  const clearFeedFilters = useCallback(() => {
    setQuery('');
    setFilterState(DEFAULT_FEED_FILTER_STATE);
  }, []);

  // Swift `syncFiltersForReviewSourceChange` when switching My ↔ Friends.
  useEffect(() => {
    setFilterState((prev) => pruneFeedFiltersForSummaries(prev, summaries));
    // Only on source switch — avoid wiping city/cuisine picks while summaries load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [reviewSource]);

  return (
    <View style={styles.screen}>
      <ReviewsHeader
        showShare={!isFriends}
        canShare={canShare}
        sharing={sharing}
        onShare={openShare}
        showImport={isFriends}
        onImport={() => {
          void pickSharePackage();
        }}
        showFilter
        canFilter={canFilter}
        filterActive={filterActive}
        onFilter={() => setFilterModalVisible(true)}
      />
      {hasFriendReviews ? (
        <ReviewSourcePicker value={reviewSource} onChange={setReviewSource} />
      ) : null}
      <FilterSearchBar value={query} onChangeText={setQuery} />
      <ActiveFilterSummary
        state={filterState}
        visibleResultCount={filtered.length}
        totalResultCount={summaries.length}
        criterionTitleFor={criterionTitleFor}
        onChange={setFilterState}
      />
      {filtered.length === 0 ? (
        <HouseEmptyState
          title={emptyTitle}
          description={emptyDescription}
          systemImage={
            emptyFromFilters
              ? 'line.3.horizontal.decrease'
              : isFriends
                ? 'person.2'
                : 'book.closed'
          }
          androidImage={
            emptyFromFilters
              ? 'filter_list'
              : isFriends
                ? 'group'
                : 'menu_book'
          }
          actionTitle={
            emptyFromFilters
              ? 'Clear filters'
              : isFriends
                ? 'Import reviews'
                : 'Add review'
          }
          onAction={
            emptyFromFilters
              ? clearFeedFilters
              : isFriends
                ? () => {
                    void pickSharePackage();
                  }
                : () => router.push('/add-review')
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.restaurantId}
          overScrollMode="never"
          onScrollBeginDrag={dismissOpenSwipeable}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                (isFriends ? 24 : 72) +
                Theme.spacing.floatingTabBarClearance +
                insets.bottom,
            },
          ]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <RestaurantFeedCard
              summary={item}
              scoreOverride={
                filterState.sortKind.type === 'criterion'
                  ? criterionAverageFor(item, filterState.sortKind.criterionId)
                  : null
              }
              onFavoriteToggle={(favorite) => {
                void setRestaurantFavorite(item.restaurantId, favorite);
              }}
              onDelete={() => {
                houseAlert(
                  'Delete restaurant?',
                  `“${item.name}” and its reviews will be permanently deleted. This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        void deleteRestaurantFromFeed(item);
                      },
                    },
                  ],
                );
              }}
              onPress={() => {
                if (item.visitCount <= 1) {
                  router.push(`/review/${item.reviewIds[0]}`);
                } else {
                  router.push({
                    pathname: '/restaurant/[id]',
                    params: { id: item.restaurantId, origin: reviewSource },
                  });
                }
              }}
            />
          )}
        />
      )}
      {!isFriends ? (
        <HouseFAB
          style={{
            bottom:
              Theme.spacing.fabBottom +
              Theme.spacing.floatingTabBarClearance +
              insets.bottom,
          }}
          onPress={() => router.push('/add-review')}
        />
      ) : null}
      <ShareReviewerNameModal
        visible={nameModalVisible}
        onCancel={() => setNameModalVisible(false)}
        onContinue={(sharedBy) => {
          updateName(sharedBy);
          // Keep this sheet up until the system share UI is up — closing first
          // flashes the feed underneath.
          void performShare(sharedBy).finally(() => {
            setNameModalVisible(false);
          });
        }}
      />
      <FilterOptionsModal
        visible={filterModalVisible}
        value={filterState}
        availableCities={availableCities}
        availablePrimaryTypes={availablePrimaryTypes}
        sortCriteria={sortCriteria}
        sourceSummaries={summaries}
        filterOptions={filterOptions}
        onApply={setFilterState}
        onReset={() => setFilterState(DEFAULT_FEED_FILTER_STATE)}
        onClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: Theme.spacing.listRowVertical,
  },
  sep: {
    height: Theme.spacing.listRowVertical * 2,
  },
});
