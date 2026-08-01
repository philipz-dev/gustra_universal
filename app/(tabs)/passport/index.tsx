import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveFilterSummary } from '@/components/feed/ActiveFilterSummary';
import { FilterOptionsModal } from '@/components/feed/FilterOptionsModal';
import { CategoryAverageRow } from '@/components/passport/CategoryAverageRow';
import { PassportSection } from '@/components/passport/PassportSection';
import { PassportStatRow } from '@/components/passport/PassportStatRow';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { usePassportDisplaySettings } from '@/context/PassportDisplaySettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import { getPassportStats } from '@/data/passportStats';
import { resolveReviewOrigin } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useSharedRestaurantFilters } from '@/hooks/useSharedRestaurantFilters';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';
import { HouseErrorBoundary } from '@/components/ui/HouseErrorBoundary';

export default function CulinaryPassportScreen() {
  const { t } = useAppTranslation();
  return (
    <HouseErrorBoundary
      fallbackTitle={t('passport.title') || 'Culinair Paspoort'}
      fallbackMessage="We konden je culinaire paspoort op dit moment niet berekenen. Probeer het scherm opnieuw te laden."
    >
      <CulinaryPassportContent />
    </HouseErrorBoundary>
  );
}

function CulinaryPassportContent() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryAveragesStyle } = usePassportDisplaySettings();
  const { enabledCriteria } = useCriteriaSettings();
  const { reviews, restaurants, ready } = useReviewsStore();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
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
    criterionTitleFor,
    filterActive,
    canFilter,
    includeFriends,
    showFriendsFilter,
  } = useSharedRestaurantFilters();

  useEffect(() => {
    if (!canFilter) setFilterModalVisible(false);
  }, [canFilter]);

  const allowedRestaurantIds = useMemo(
    () => new Set(filteredSummaries.map((s) => s.restaurantId)),
    [filteredSummaries],
  );

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      if (!allowedRestaurantIds.has(review.restaurantId)) return false;
      const origin = resolveReviewOrigin(review);
      if (origin === 'own') return true;
      return includeFriends && origin === 'imported';
    });
  }, [allowedRestaurantIds, includeFriends, reviews]);

  const stats = useMemo(
    () =>
      ready
        ? getPassportStats(enabledCriteria, filteredReviews, restaurants)
        : getPassportStats(enabledCriteria, [], []),
    [enabledCriteria, filteredReviews, ready, restaurants],
  );

  const bestSectionTitle =
    stats.bestRestaurants.length === 1
      ? t('passport.bestRestaurant')
      : t('passport.bestRestaurants');

  const emptyFromFilters =
    sourceSummaries.length > 0 &&
    filteredSummaries.length === 0 &&
    filterActive;

  return (
    <View style={styles.screen}>
      <ReviewsHeader
        title={t('tabs.passport')}
        showShare={false}
        showFilter
        canFilter={canFilter}
        filterActive={filterActive}
        onFilter={() => setFilterModalVisible(true)}
      />
      <ActiveFilterSummary
        state={filterState}
        visibleResultCount={filteredSummaries.length}
        totalResultCount={sourceSummaries.length}
        criterionTitleFor={criterionTitleFor}
        onChange={setFilterState}
        containerStyle={styles.filterGap}
      />

      {stats.totalReviews === 0 ? (
        <View style={styles.emptyPad}>
          <HouseEmptyState
            title={
              emptyFromFilters
                ? t('reviews.empty.noMatchesShort')
                : t('passport.emptyTitle')
            }
            description={
              emptyFromFilters
                ? t('reviews.empty.noMatchesBody')
                : t('passport.emptyBody')
            }
            systemImage={
              emptyFromFilters
                ? 'magnifyingglass'
                : 'chart.bar.doc.horizontal'
            }
            androidImage={emptyFromFilters ? 'search_off' : 'bar_chart'}
            actionTitle={
              emptyFromFilters
                ? t('reviews.empty.clearFilters')
                : t('passport.addReview')
            }
            onAction={
              emptyFromFilters
                ? resetFilterState
                : () => router.push('/add-review')
            }
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
            },
          ]}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}>
          <PassportSection title={t('passport.overview')}>
            <PassportStatRow
              title={t('passport.totalReviews')}
              value={`${stats.totalReviews}`}
            />
            <PassportStatRow
              title={t('passport.averageOverall')}
              value={formatScoreOutOfFive(stats.averageOverall)}
            />
          </PassportSection>

          {stats.bestRestaurants.length > 0 ? (
            <PassportSection title={bestSectionTitle}>
              {stats.bestRestaurants.map((entry, index) => (
                <Pressable
                  key={entry.restaurantId}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(`/passport/review/${entry.reviewId}`)
                  }
                  style={({ pressed }) => pressed && styles.linkPressed}>
                  <CategoryAverageRow
                    title={entry.title}
                    average={entry.average}
                    style={categoryAveragesStyle}
                    rank={index + 1}
                  />
                </Pressable>
              ))}
            </PassportSection>
          ) : null}

          {stats.criterionAverages.length > 0 ? (
            <PassportSection title={t('passport.categoryAverages')}>
              {stats.criterionAverages.map((row) => (
                <CategoryAverageRow
                  key={row.id}
                  title={row.title}
                  average={row.average}
                  style={categoryAveragesStyle}
                />
              ))}
            </PassportSection>
          ) : null}

          <PassportSection title={t('passport.topCities')}>
            {stats.cityAverages.length === 0 ? (
              <View style={styles.mutedRow}>
                <Text style={styles.muted}>{t('passport.noCityData')}</Text>
              </View>
            ) : (
              stats.cityAverages.map((row, index) => (
                <CategoryAverageRow
                  key={row.city}
                  title={row.city}
                  average={row.average}
                  style={categoryAveragesStyle}
                  rank={index + 1}
                />
              ))
            )}
          </PassportSection>
        </ScrollView>
      )}

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

      <View
        pointerEvents="none"
        style={[
          styles.bottomSolid,
          { height: Theme.spacing.floatingTabBarClearance + insets.bottom },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bottomFade,
          { bottom: Theme.spacing.floatingTabBarClearance + insets.bottom },
        ]}>
        <LinearGradient
          colors={['rgba(245, 240, 225, 0)', GustraColors.cream]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: Theme.list.sectionGap,
  },
  emptyPad: {
    flex: 1,
    paddingHorizontal: Theme.spacing.listRowHorizontal,
  },
  /** Gap between the green banner and the filter chips (no search bar here). */
  filterGap: {
    backgroundColor: GustraColors.cream,
    paddingTop: Theme.spacing.searchVertical,
  },
  bottomSolid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GustraColors.cream,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Theme.size.fab + 24,
  },
  mutedRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  muted: {
    color: 'rgba(35, 32, 26, 0.45)',
    fontSize: 15,
  },
  linkPressed: {
    opacity: 0.85,
  },
});
