import { useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ActiveFilterSummary } from '@/components/feed/ActiveFilterSummary';
import { FilterOptionsModal } from '@/components/feed/FilterOptionsModal';
import { PassportSection } from '@/components/passport/PassportSection';
import { PassportStatRow } from '@/components/passport/PassportStatRow';
import { SerifText } from '@/components/ui/SerifText';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme, captionTextStyle, serifStyle } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import {
  getBestWines,
  getPassportStats,
  type BestRestaurantEntry,
  type BestWineEntry,
} from '@/data/passportStats';
import { resolveReviewOrigin } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useSharedRestaurantFilters } from '@/hooks/useSharedRestaurantFilters';
import {
  RatingValue,
  formatScoreOutOfFive,
} from '@/services/reviews/ratings';
import { HouseErrorBoundary } from '@/components/ui/HouseErrorBoundary';

/** Gold rank medal ("1" / "2" / "3") on a cream disc. */
function RankMedal({ rank }: { rank: number }) {
  return (
    <View style={styles.medal}>
      <Text style={styles.medalText}>{rank}</Text>
    </View>
  );
}

/**
 * Best Restaurants Top-3 podium: #1 is a full-width hero card with a deep
 * forest gradient + subtle gold glow; #2 and #3 are two compact cards side by
 * side. Photo-free on purpose (backwards-compatible — no schema change).
 */
function BestRestaurantPodium({
  entries,
  onPress,
}: {
  entries: BestRestaurantEntry[];
  onPress: (reviewId: string) => void;
}) {
  const [first, ...rest] = entries;
  if (!first) return null;
  const showPhoto = Boolean(first.photoUrl);
  return (
    <View style={styles.podium}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`1. ${first.title}, ${formatScoreOutOfFive(first.average)}, ${showPhoto ? 'photo' : ''}`}
        onPress={() => onPress(first.reviewId)}
        style={({ pressed }) => [
          styles.podiumHero,
          pressed && styles.linkPressed,
        ]}>
        {showPhoto ? (
          <>
            <ImageBackground
              source={{ uri: first.photoUrl }}
              style={StyleSheet.absoluteFill}
              imageStyle={styles.podiumHeroImg}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[
                'rgba(10, 8, 4, 0)',
                'rgba(10, 8, 4, 0.2)',
                'rgba(8, 6, 3, 0.82)',
              ]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <>
            <LinearGradient
              colors={['#2E5D44', '#1B3A2A', '#10241B']}
              style={StyleSheet.absoluteFill}
            />
            {/* subtle gold glow dots */}
            <View style={[styles.glowDot, styles.glowDotA]} />
            <View style={[styles.glowDot, styles.glowDotB]} />
          </>
        )}
        <RankMedal rank={1} />
        <View style={styles.podiumHeroCopy}>
          <Text style={styles.podiumHeroTitle} numberOfLines={2}>
            {first.title}
          </Text>
          <SerifText size={22} weight="bold" style={styles.podiumHeroScore}>
            {formatScoreOutOfFive(first.average)}
          </SerifText>
        </View>
      </Pressable>

      {rest.length > 0 ? (
        <View style={styles.podiumRow}>
          {rest.map((entry, index) => (
            <Pressable
              key={entry.restaurantId}
              accessibilityRole="button"
              accessibilityLabel={`${index + 2}. ${entry.title}, ${formatScoreOutOfFive(entry.average)}`}
              onPress={() => onPress(entry.reviewId)}
              style={({ pressed }) => [
                styles.podiumCard,
                pressed && styles.linkPressed,
              ]}>
              <RankMedal rank={index + 2} />
              <Text style={styles.podiumCardTitle} numberOfLines={2}>
                {entry.title}
              </Text>
              <SerifText size={17} weight="semibold" style={styles.podiumCardScore}>
                {formatScoreOutOfFive(entry.average)}
              </SerifText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Ranked bottle row: medal + name + its own star rating (Best Wines). */
function RankedWineRow({
  entry,
  rank,
  onPress,
}: {
  entry: BestWineEntry;
  rank: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${entry.fiche.nameAndEstate}, ${formatScoreOutOfFive(
        RatingValue.starValue(entry.rating),
      )}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wineCard,
        pressed && styles.linkPressed,
      ]}>
      <RankMedal rank={rank} />
      <Text style={styles.wineTitle} numberOfLines={2}>
        {entry.fiche.nameAndEstate}
      </Text>
      <View style={styles.wineScoreRow}>
        <SerifText size={17} weight="semibold" style={styles.wineScore}>
          {formatScoreOutOfFive(RatingValue.starValue(entry.rating))}
        </SerifText>
      </View>
    </Pressable>
  );
}

/** City average row: reserved serif number (stars stay exclusive to top). */
function CityRow({
  rank,
  city,
  average,
}: {
  rank: number;
  city: string;
  average: number;
}) {
  return (
    <View style={styles.cityRow}>
      <RankMedal rank={rank} />
      <Text style={styles.cityTitle} numberOfLines={2}>
        {city}
      </Text>
      <SerifText size={17} weight="semibold" style={styles.cityScore}>
        {formatScoreOutOfFive(average)}
      </SerifText>
    </View>
  );
}

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

  const bestWines = useMemo(
    () => getBestWines(filteredReviews),
    [filteredReviews],
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
              <BestRestaurantPodium
                entries={stats.bestRestaurants}
                onPress={(reviewId) => router.push(`/passport/review/${reviewId}`)}
              />
            </PassportSection>
          ) : null}

          {bestWines.length > 0 ? (
            <PassportSection title={t('passport.bestWines')}>
              {bestWines.map((entry, index) => (
                <RankedWineRow
                  key={`${entry.reviewId}-${index}`}
                  entry={entry}
                  rank={index + 1}
                  onPress={() =>
                    router.push(`/passport/review/${entry.reviewId}`)
                  }
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
                <CityRow key={row.city} rank={index + 1} city={row.city} average={row.average} />
              ))
            )}
          </PassportSection>

          <PassportSection title="">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('passport.timeTravel')}
              accessibilityHint={t('passport.timeTravelSubtitle')}
              onPress={() => router.push('/passport/timemachine')}
              style={({ pressed }) => [
                styles.timeTravelBanner,
                pressed && styles.linkPressed,
              ]}>
              <LinearGradient
                colors={['#2E5D44', '#1B3A2A', '#0F2118']}
                style={StyleSheet.absoluteFill}
              />
              {/* subtle gold glow — "portal to the past", not a starfield */}
              <View style={[styles.bannerGlow, styles.bannerGlowA]} />
              <View style={[styles.bannerGlow, styles.bannerGlowB]} />
              <View style={styles.timeTravelIcon}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="clock.arrow.circlepath"
                    tintColor={GustraColors.gold}
                    size={26}
                  />
                ) : (
                  <MaterialIcons
                    name="history"
                    size={26}
                    color={GustraColors.gold}
                  />
                )}
              </View>
              <View style={styles.timeTravelCopy}>
                <SerifText size={18} weight="bold" style={styles.timeTravelTitle}>
                  {t('passport.timeTravel')}
                </SerifText>
                <Text style={styles.timeTravelSubtitle}>
                  {t('passport.timeTravelSubtitle')}
                </Text>
              </View>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="chevron.right"
                  tintColor={GustraColors.gold}
                  size={18}
                />
              ) : (
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={GustraColors.gold}
                />
              )}
            </Pressable>
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
  /* ——— Time Travel cinematic banner ——— */
  timeTravelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217, 162, 39, 0.45)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bannerGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(217, 162, 39, 0.16)',
    shadowColor: GustraColors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  bannerGlowA: {
    top: -30,
    right: -20,
  },
  bannerGlowB: {
    bottom: -40,
    left: 40,
    backgroundColor: 'rgba(217, 162, 39, 0.08)',
  },
  timeTravelIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeTravelCopy: {
    flex: 1,
    gap: 3,
  },
  timeTravelTitle: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeTravelSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(255, 253, 245, 0.75)',
  },

  /* ——— Top-3 podium ——— */
  podium: {
    gap: 10,
  },
  podiumHero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 132,
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217, 162, 39, 0.4)',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  podiumHeroImg: {
    borderRadius: 24,
  },
  glowDot: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(217, 162, 39, 0.14)',
    shadowColor: GustraColors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  glowDotA: {
    top: -24,
    right: -12,
  },
  glowDotB: {
    bottom: -30,
    left: 20,
    backgroundColor: 'rgba(217, 162, 39, 0.07)',
  },
  podiumHeroCopy: {
    flex: 1,
    gap: 8,
  },
  podiumHeroTitle: {
    ...serifStyle(22, 'bold'),
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  podiumHeroScore: {
    color: GustraColors.gold,
    fontVariant: ['tabular-nums'],
  },
  podiumRow: {
    flexDirection: 'row',
    gap: 10,
  },
  podiumCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  podiumCardTitle: {
    ...serifStyle(15, 'semibold'),
    flex: 1,
    color: GustraColors.ink,
  },
  podiumCardScore: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },

  /* ——— Rank medal ——— */
  medal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(217, 162, 39, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217, 162, 39, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    ...serifStyle(14, 'bold'),
    color: GustraColors.gold,
    fontVariant: ['tabular-nums'],
  },

  /* ——— Best Wines rows ——— */
  wineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  wineTitle: {
    ...serifStyle(16, 'semibold'),
    flex: 1,
    color: GustraColors.ink,
  },
  wineScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wineScore: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },

  /* ——— City rows (number-only, no stars) ——— */
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: 12,
  },
  cityTitle: {
    ...serifStyle(16, 'semibold'),
    flex: 1,
    color: GustraColors.ink,
  },
  cityScore: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },

  linkPressed: {
    opacity: 0.85,
  },
});
