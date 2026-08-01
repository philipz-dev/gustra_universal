import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';

import { houseAlert } from '@/components/ui/HouseAlert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveFilterSummary } from '@/components/feed/ActiveFilterSummary';
import { FilterOptionsModal } from '@/components/feed/FilterOptionsModal';
import { FilterSearchBar } from '@/components/feed/FilterSearchBar';
import { hasFeedFilter } from '@/components/feed/feedFilters';
import { dismissOpenSwipeable } from '@/components/feed/openSwipeable';
import { ShareReviewerNameModal } from '@/components/feed/ShareReviewerNameModal';
import { RestaurantFeedCard } from '@/components/feed/RestaurantFeedCard';
import { HouseErrorBoundary } from '@/components/ui/HouseErrorBoundary';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseFAB } from '@/components/ui/HouseFAB';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle } from '@/constants/Theme';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import { consumePendingEnableFriendsFilter } from '@/context/pendingFriendsFilter';
import type { RestaurantVisitSummary, Review } from '@/data/types';
import { resolveReviewOrigin } from '@/data/types';
import { isDemoReviewId } from '@/data/mockReviews';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useSharedRestaurantFilters } from '@/hooks/useSharedRestaurantFilters';
import { shareReviewsPackage } from '@/services/share/ReviewShareService';
import { requestSwipeDelete } from '@/services/swipeDelete';
import { Haptics } from '@/services/haptics';

export default function ReviewsFeedScreen() {
  const { t } = useAppTranslation();
  return (
    <HouseErrorBoundary
      fallbackTitle={t('tabs.reviews') || 'Reviews'}
      fallbackMessage="We konden de reviews op dit moment niet laden. Probeer het scherm opnieuw te openen."
    >
      <ReviewsFeedContent />
    </HouseErrorBoundary>
  );
}

function ReviewsFeedContent() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [isShareSelecting, setIsShareSelecting] = useState(false);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<Set<string>>(
    () => new Set(),
  );

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    resyncRestaurantCovers,
    ready,
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
  // Always re-derive cover thumbs from visit photos when opening Reviews
  // (e.g. after adding a photo in Edit — restaurant.photoUrl can lag).
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      void resyncRestaurantCovers();
    }, [ready, resyncRestaurantCovers]),
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

  const visibleFeed = useMemo(
    () =>
      filtered.filter(
        (summary) =>
          !pendingDeleteIds.has(summary.restaurantId) &&
          (!isShareSelecting || !summary.isDraft),
      ),
    [filtered, pendingDeleteIds, isShareSelecting],
  );

  const requestDeleteRestaurant = useCallback(
    (item: RestaurantVisitSummary) => {
      const id = item.restaurantId;
      requestSwipeDelete({
        title: t('alerts.deleteRestaurant.title'),
        message: t('alerts.deleteRestaurant.body'),
        undoMessage: t('alerts.deleteRestaurant.undoMessage'),
        onHide: () => {
          setPendingDeleteIds((prev) => new Set(prev).add(id));
        },
        onRestore: () => {
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
        onCommit: () => {
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          void deleteRestaurantFromFeed(item);
        },
      });
    },
    [deleteRestaurantFromFeed, t],
  );

  /** Visible feed rows → own reviews only (share never sends friends). */
  const reviewsToShare = useMemo(() => {
    const list: Review[] = [];
    for (const summary of filtered) {
      if (isShareSelecting && !selectedRestaurantIds.has(summary.restaurantId)) {
        continue;
      }
      for (const id of summary.reviewIds) {
        const review = getReview(id);
        if (
          review &&
          resolveReviewOrigin(review) === 'own' &&
          !isDemoReviewId(review.id)
        ) {
          list.push(review);
        }
      }
    }
    return list;
  }, [filtered, getReview, isShareSelecting, selectedRestaurantIds]);

  const canShare = reviewsToShare.length > 0 && !sharing;

  const performShare = useCallback(
    async (sharedByOverride?: string) => {
      const targetReviews = reviewsToShare;
      if (targetReviews.length === 0) return;
      if (isMountedRef.current) {
        setSharing(true);
      }
      try {
        const profile = await getBackupSnapshot();
        const sharedBy = (sharedByOverride ?? profile.name).trim();
        if (!sharedBy) {
          throw new Error(t('alerts.share.needName'));
        }
        await shareReviewsPackage({
          reviews: targetReviews,
          restaurants,
          sharedBy,
          sharedById: profile.authorId,
          sharedByPhotoBase64: profile.photoBase64,
        });
        if (isMountedRef.current) {
          setIsShareSelecting(false);
          setSelectedRestaurantIds(new Set());
        }
      } catch (error) {
        houseAlert(
          t('common.error'),
          error instanceof Error
            ? error.message
            : t('alerts.share.failed'),
        );
      } finally {
        if (isMountedRef.current) {
          setSharing(false);
        }
      }
    },
    [getBackupSnapshot, restaurants, reviewsToShare, t],
  );

  const openShare = useCallback(() => {
    setIsShareSelecting(true);
    setSelectedRestaurantIds(new Set());
  }, []);

  const handleToggleSelect = (restaurantId: string) => {
    Haptics.selectionChanged();
    setSelectedRestaurantIds((prev) => {
      const next = new Set(prev);
      if (next.has(restaurantId)) {
        next.delete(restaurantId);
      } else {
        next.add(restaurantId);
      }
      return next;
    });
  };

  const handleConfirmSharing = () => {
    if (selectedRestaurantIds.size === 0) return;
    if (!hasName) {
      setNameModalVisible(true);
      return;
    }
    void performShare();
  };

  const handleCancelSharing = () => {
    setIsShareSelecting(false);
    setSelectedRestaurantIds(new Set());
    setNameModalVisible(false);
  };

  const handleNameContinue = (name: string) => {
    updateName(name);
    setNameModalVisible(false);
    void performShare(name);
  };

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

  const headerTitle = isShareSelecting
    ? t('share.selectReviews')
    : undefined;

  const selectAllOn = visibleFeed.length > 0 && selectedRestaurantIds.size === visibleFeed.length;

  const feedExtraData = useMemo(() => {
    const sortKey =
      filterState.sortKind.type === 'criterion'
        ? `criterion:${filterState.sortKind.criterionId}`
        : filterState.sortKind.type;
    return `${isShareSelecting}|${Array.from(selectedRestaurantIds).join(',')}|${sortKey}`;
  }, [isShareSelecting, selectedRestaurantIds, filterState.sortKind]);

  const handleToggleSelectAll = () => {
    Haptics.selectionChanged();
    if (selectAllOn) {
      setSelectedRestaurantIds(new Set());
    } else {
      setSelectedRestaurantIds(new Set(visibleFeed.map((s) => s.restaurantId)));
    }
  };

  const selectAllBar = isShareSelecting && visibleFeed.length > 0 ? (
    <View style={styles.selectAllContainer}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selectAllOn }}
        onPress={handleToggleSelectAll}
        style={({ pressed }) => [
          styles.selectAllRow,
          pressed && styles.pressed,
        ]}>
        <SymbolView
          name={{
            ios: selectAllOn ? 'checkmark.circle.fill' : 'circle',
            android: selectAllOn ? 'check_circle' : 'radio_button_unchecked',
            web: selectAllOn ? 'check_circle' : 'radio_button_unchecked',
          }}
          tintColor={selectAllOn ? GustraColors.forestGreen : 'rgba(35, 32, 26, 0.35)'}
          size={24}
        />
        <Text style={styles.selectAllLabel}>{t('filters.selectAll')}</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <ReviewsHeader
        title={headerTitle}
        showShare
        canShare={canShare}
        sharing={sharing}
        onShare={openShare}
        showFilter={!isShareSelecting}
        canFilter={canFilter}
        filterActive={filterActive}
        onFilter={() => setFilterModalVisible(true)}
        isSelecting={isShareSelecting}
        onCancelSelecting={handleCancelSharing}
        onConfirmSelecting={handleConfirmSharing}
        canConfirmSelecting={selectedRestaurantIds.size > 0}
      />
      {!isShareSelecting ? <FilterSearchBar value={query} onChangeText={setQuery} /> : null}
      <ActiveFilterSummary
        state={filterState}
        visibleResultCount={filtered.length}
        totalResultCount={sourceSummaries.length}
        criterionTitleFor={criterionTitleFor}
        onChange={setFilterState}
        containerStyle={isShareSelecting ? styles.filterGapInSelect : undefined}
      />
      {selectAllBar}
      <View style={styles.body} collapsable={false}>
        {filtered.length === 0 ? (
          <HouseEmptyState
            title={emptyTitle}
            description={emptyDescription}
            systemImage={
              emptyFromFilters
                ? 'magnifyingglass'
                : 'book.closed'
            }
            androidImage={emptyFromFilters ? 'search_off' : 'menu_book'}
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
            data={visibleFeed}
            extraData={feedExtraData}
            keyExtractor={(item) => item.restaurantId}
            overScrollMode="never"
            onScrollBeginDrag={dismissOpenSwipeable}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.list,
              {
                paddingBottom:
                  Theme.spacing.floatingTabBarClearance +
                  insets.bottom +
                  140,
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
                onDelete={() => requestDeleteRestaurant(item)}
                shareSelecting={isShareSelecting}
                selected={selectedRestaurantIds.has(item.restaurantId)}
                onSelectToggle={() => handleToggleSelect(item.restaurantId)}
                onPress={() => {
                  if (item.isDraft) {
                    const draftId =
                      item.draftReviewId ?? item.reviewIds[0];
                    if (draftId) {
                      router.push({
                        pathname: '/review-form',
                        params: { reviewId: draftId },
                      });
                      return;
                    }
                  }
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
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height:
              Theme.spacing.floatingTabBarClearance + insets.bottom,
            backgroundColor: GustraColors.cream,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom:
              Theme.spacing.floatingTabBarClearance + insets.bottom,
            height: Theme.size.fab + 24,
          }}>
          <LinearGradient
            colors={['rgba(245, 240, 225, 0)', GustraColors.cream]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {!isShareSelecting ? (
          <HouseFAB
            collapsable={false}
            style={{
              bottom:
                Theme.spacing.floatingTabBarClearance +
                insets.bottom +
                24,
            }}
            onPress={() => router.push('/add-review')}
          />
        ) : null}
      </View>
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

      <ShareReviewerNameModal
        visible={nameModalVisible}
        onCancel={() => setNameModalVisible(false)}
        onContinue={handleNameContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  /**
   * In share-select mode the FilterSearchBar is hidden, so the filter summary
   * would sit flush under the green banner — add a cream gap instead.
   */
  filterGapInSelect: {
    backgroundColor: GustraColors.cream,
    paddingTop: Theme.spacing.searchVertical,
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
  selectAllContainer: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 12,
    backgroundColor: GustraColors.cream,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectAllLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});
