import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveFilterSummary } from '@/components/feed/ActiveFilterSummary';
import { FilterOptionsModal } from '@/components/feed/FilterOptionsModal';
import { FilterSearchBar } from '@/components/feed/FilterSearchBar';
import { hasFeedFilter } from '@/components/feed/feedFilters';
import { dismissOpenSwipeable } from '@/components/feed/openSwipeable';
import { RestaurantFeedCard } from '@/components/feed/RestaurantFeedCard';
import { ShareReviewerNameModal } from '@/components/feed/ShareReviewerNameModal';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseFAB } from '@/components/ui/HouseFAB';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import { consumePendingEnableFriendsFilter } from '@/context/pendingFriendsFilter';
import type { Review } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useSharedRestaurantFilters } from '@/hooks/useSharedRestaurantFilters';
import { shareReviewsPackage } from '@/services/share/ReviewShareService';

export default function ReviewsFeedScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const {
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
    showFriendsFilter,
  } = useSharedRestaurantFilters();
  const {
    getReview,
    restaurants,
    deleteRestaurantFromFeed,
    setRestaurantFavorite,
  } = useReviewsStore();
  const { hasName, updateName, getBackupSnapshot } = useReviewerProfile();
  // After share-import: turn on Include friend's reviews.
  useFocusEffect(
    useCallback(() => {
      if (!consumePendingEnableFriendsFilter()) return;
      setFilterState((prev) =>
        hasFeedFilter(prev, 'friends')
          ? prev
          : { ...prev, filters: [...prev.filters, 'friends'] },
      );
    }, [setFilterState]),
  );

  useEffect(() => {
    if (!canFilter) setFilterModalVisible(false);
  }, [canFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredSummaries;
    return filteredSummaries.filter((summary) => {
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
  }, [filteredSummaries, getReview, query]);

  /** Visible feed rows → own reviews only (share never sends friends). */
  const reviewsToShare = useMemo(() => {
    const list: Review[] = [];
    for (const summary of filtered) {
      for (const id of summary.reviewIds) {
        const review = getReview(id);
        if (review && resolveReviewOrigin(review) === 'own') list.push(review);
      }
    }
    return list;
  }, [filtered, getReview]);

  const canShare = reviewsToShare.length > 0 && !sharing;

  const performShare = useCallback(
    async (sharedByOverride?: string) => {
      if (reviewsToShare.length === 0) return;
      setSharing(true);
      try {
        const profile = await getBackupSnapshot();
        const sharedBy = (sharedByOverride ?? profile.name).trim();
        if (!sharedBy) {
          throw new Error(t('alerts.share.needName'));
        }
        await shareReviewsPackage({
          reviews: reviewsToShare,
          restaurants,
          sharedBy,
          sharedById: profile.authorId,
          sharedByPhotoBase64: profile.photoBase64,
        });
      } catch (error) {
        houseAlert(
          t('common.error'),
          error instanceof Error
            ? error.message
            : t('alerts.share.failed'),
        );
      } finally {
        setSharing(false);
      }
    },
    [getBackupSnapshot, restaurants, reviewsToShare, t],
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
    sourceSummaries.length > 0 &&
    filtered.length === 0 &&
    (filterActive || query);
  const emptyTitle = emptyFromFilters
    ? filterState.sortKind.type === 'criterion' && !query
      ? t('reviews.empty.noMatchesTitle')
      : t('reviews.empty.noMatchesShort')
    : t('reviews.empty.noReviewsTitle');
  const emptyDescription = emptyFromFilters
    ? query
      ? t('reviews.empty.tryAnotherSearch')
      : filterState.sortKind.type === 'criterion'
        ? t('reviews.empty.noCriterionRating')
        : t('reviews.empty.noMatchesBody')
    : t('reviews.empty.noReviewsBody');

  const clearFeedFilters = useCallback(() => {
    setQuery('');
    resetFilterState();
  }, [resetFilterState]);

  return (
    <View style={styles.screen}>
      <ReviewsHeader
        showShare
        canShare={canShare}
        sharing={sharing}
        onShare={openShare}
        showFilter
        canFilter={canFilter}
        filterActive={filterActive}
        onFilter={() => setFilterModalVisible(true)}
      />
      <FilterSearchBar value={query} onChangeText={setQuery} />
      <ActiveFilterSummary
        state={filterState}
        visibleResultCount={filtered.length}
        totalResultCount={sourceSummaries.length}
        criterionTitleFor={criterionTitleFor}
        onChange={setFilterState}
      />
      <View style={styles.body} collapsable={false}>
        {filtered.length === 0 ? (
          <HouseEmptyState
            title={emptyTitle}
            description={emptyDescription}
            systemImage={
              emptyFromFilters
                ? 'line.3.horizontal.decrease'
                : 'book.closed'
            }
            androidImage={emptyFromFilters ? 'filter_list' : 'menu_book'}
            actionTitle={
              emptyFromFilters
                ? t('reviews.empty.clearFilters')
                : t('reviews.empty.addReview')
            }
            onAction={
              emptyFromFilters
                ? clearFeedFilters
                : () => router.push('/add-review')
            }
          />
        ) : (
          <FlatList
            style={styles.listFlex}
            data={filtered}
            keyExtractor={(item) => item.restaurantId}
            overScrollMode="never"
            onScrollBeginDrag={dismissOpenSwipeable}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.list,
              {
                paddingBottom:
                  72 +
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
                    t('alerts.deleteRestaurant.title'),
                    t('alerts.deleteRestaurant.body'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.delete'),
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
                      params: {
                        id: item.restaurantId,
                        // Friends included → show all visits; else own only.
                        ...(includeFriends ? {} : { origin: 'own' }),
                      },
                    });
                  }
                }}
              />
            )}
          />
        )}
        <HouseFAB
          collapsable={false}
          style={{
            bottom:
              Theme.spacing.fabBottom +
              Theme.spacing.floatingTabBarClearance +
              insets.bottom,
          }}
          onPress={() => router.push('/add-review')}
        />
      </View>
      <ShareReviewerNameModal
        visible={nameModalVisible}
        onCancel={() => setNameModalVisible(false)}
        onContinue={(sharedBy) => {
          updateName(sharedBy);
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
        sourceSummaries={ownSummaries}
        friendSummaries={friendSummaries}
        filterOptions={filterOptions}
        showFriendsFilter={showFriendsFilter}
        onApply={setFilterState}
        onReset={resetFilterState}
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
  body: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  listFlex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: Theme.spacing.listRowVertical,
  },
  sep: {
    height: Theme.spacing.listRowVertical * 2,
  },
});
