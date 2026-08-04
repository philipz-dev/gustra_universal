import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type FlatList as FlatListType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { SelectedRestaurantBanner } from '@/components/review/SelectedRestaurantBanner';
import { SelectionCheckmark } from '@/components/review/SelectionCheckmark';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { TabBarBottomFade } from '@/components/ui/TabBarBottomFade';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import { isDemoReviewId } from '@/data/mockReviews';
import { resolveReviewOrigin } from '@/data/types';
import type { Restaurant, Review } from '@/data/types';
import { Haptics } from '@/services/haptics';
import {
  openSystemSettings,
  resolveCurrentLocation,
} from '@/services/location/resolveCurrentLocation';
import {
  FALLBACK_MAP_CENTER,
  findExistingRestaurant,
  formattedDistance,
  isSameRestaurantDraft,
  MAX_NEARBY_SEARCH_RADIUS_M,
  restaurantDraftFromResult,
  searchNearby,
  type RestaurantDraft,
  type RestaurantSearchResult,
} from '@/services/places';
import { useAppTranslation } from '@/hooks/useAppTranslation';

/** Fixed row height for the results list (paddingVertical 14 ×2 + two lines). */
const ROW_HEIGHT = 64;
/** Height of the uppercase section-title header above the rows. */
const HEADER_HEIGHT = 36;

type FallbackLocation = {
  center: { latitude: number; longitude: number };
  label: string;
};

/**
 * Reference point for "nearby" when GPS is denied or unavailable.
 * Prefers the most recent real visit (own review) with known coordinates;
 * falls back to the shared default map center. Returns null only when there
 * is no review data at all — then the picker shows the friendly dead end.
 */
function fallbackCenterFromReviews(
  reviews: Review[],
  restaurants: Restaurant[],
): FallbackLocation | null {
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const ownVisits = reviews
    .filter((r) => {
      if (resolveReviewOrigin(r) !== 'own') return false;
      if (isDemoReviewId(r.id)) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  for (const review of ownVisits) {
    const restaurant = byId.get(review.restaurantId);
    if (
      restaurant &&
      Number.isFinite(restaurant.latitude) &&
      Number.isFinite(restaurant.longitude) &&
      restaurant.latitude !== 0 &&
      restaurant.longitude !== 0
    ) {
      return {
        center: {
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
        },
        label: restaurant.city?.trim() || restaurant.name,
      };
    }
  }

  if (restaurants.length > 0) {
    return { center: FALLBACK_MAP_CENTER, label: '' };
  }
  return null;
}

/**
 * Nearby restaurant picker (Swift `NearbyRestaurantSelectionView`).
 * Selecting a place shows the Start Review banner; review form comes later.
 */
export default function NearbyRestaurantsScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reviews, restaurants, addDraftToBucketList, setRestaurantBucket } =
    useReviewsStore();
  const listRef = useRef<FlatListType<RestaurantSearchResult>>(null);
  const [selected, setSelected] = useState<RestaurantDraft | null>(null);
  const [results, setResults] = useState<RestaurantSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOpenSettings, setShowOpenSettings] = useState(false);
  /** When GPS is denied/unavailable but we still have a reference point. */
  const [fallbackLabel, setFallbackLabel] = useState<string | null>(null);

  const loadNearby = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setShowOpenSettings(false);
    setFallbackLabel(null);
    setResults([]);

    const location = await resolveCurrentLocation();

    if (location.coords) {
      try {
        // Wide circle (API max 50 km): Google still returns only the 20
        // closest places, so urban users see truly-nearby results while
        // remote users are not left with an empty list.
        const found = await searchNearby(location.coords, MAX_NEARBY_SEARCH_RADIUS_M);
        setResults(found);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('forms.nearby.searchFailed'),
        );
      }
      return;
    }

    // No GPS fix. Fall back to the user's most recent reviewed area (or the
    // default map center) so the picker stays usable instead of a dead end.
    const fallback = fallbackCenterFromReviews(reviews, restaurants);
    if (fallback) {
      setFallbackLabel(fallback.label);
      try {
        const found = await searchNearby(fallback.center, MAX_NEARBY_SEARCH_RADIUS_M);
        setResults(found);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('forms.nearby.searchFailed'),
        );
      }
      return;
    }

    // No location, no fallback — show the friendly dead-end state.
    setIsLoading(false);
    setShowOpenSettings(location.isAuthorizationDenied);
    setErrorMessage(location.error ?? t('alerts.location.unavailable'));
  }, [reviews, restaurants, t]);

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  const selectRestaurant = (item: RestaurantSearchResult) => {
    Haptics.selectionChanged();
    setSelected(restaurantDraftFromResult(item));
    const index = results.findIndex((result) => result.id === item.id);
    if (index >= 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.2,
        });
      });
    }
  };

  const selectedVisitedCount = useMemo(() => {
    if (!selected) return 0;
    const existing = findExistingRestaurant(selected, restaurants);
    if (!existing) return 0;
    return reviews.filter(
      (r) =>
        r.restaurantId === existing.id && resolveReviewOrigin(r) === 'own',
    ).length;
  }, [reviews, restaurants, selected]);

  const selectedInBucketList = useMemo(() => {
    if (!selected) return false;
    return (
      findExistingRestaurant(selected, restaurants)?.isInBucketList ?? false
    );
  }, [restaurants, selected]);

  const handleToggleBucketList = useCallback(async () => {
    if (!selected) return;
    const existing = findExistingRestaurant(selected, restaurants);
    if (existing?.isInBucketList) {
      await setRestaurantBucket(existing.id, false);
      return;
    }
    await addDraftToBucketList(selected);
  }, [addDraftToBucketList, restaurants, selected, setRestaurantBucket]);

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title=""
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => router.back()}
      />

      {selected ? (
        <View style={styles.bannerPad}>
          <SelectedRestaurantBanner
            draft={selected}
            actionTitle={t("forms.nearby.startReview")}
            visitedCount={selectedVisitedCount}
            onToggleBucketList={handleToggleBucketList}
            inBucketList={selectedInBucketList}
            onClear={() => {
              setSelected(null);
              router.back();
            }}
            onAction={() =>
              router.push({
                pathname: '/review-form',
                params: { draft: JSON.stringify(selected) },
              })
            }
          />
        </View>
      ) : null}

      {fallbackLabel ? (
        <View style={styles.fallbackRow}>
          <SymbolView
            name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }}
            tintColor={GustraColors.forestGreen}
            size={16}
          />
          <Text style={styles.fallbackText}>
            {fallbackLabel
              ? t('forms.nearby.usingFallbackCity', { city: fallbackLabel })
              : t('forms.nearby.usingFallback')}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={GustraColors.forestGreen} />
          <Text style={styles.loadingText}>{t("forms.nearby.finding")}</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.flexFill}>
          <HouseEmptyState
            title={t("forms.nearby.loadFailed")}
            description={errorMessage}
            systemImage="location.slash"
            androidImage="location_off"
            actionTitle={showOpenSettings ? t('common.openSettings') : t('common.tryAgain')}
            onAction={() => {
              if (showOpenSettings) {
                openSystemSettings();
              } else {
                void loadNearby();
              }
            }}
            secondaryActionTitle={t('common.browseMap')}
            secondaryOnAction={() => router.push('/map-search')}
          />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.flexFill}>
          <HouseEmptyState
            title={t("forms.nearby.noNearby")}
            description={t("forms.nearby.tryMap")}
            systemImage="mappin.and.ellipse"
            androidImage="place"
            actionTitle={t("forms.nearby.searchNearby")}
            onAction={() => {
              void loadNearby();
            }}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flexFill}
          data={results}
          keyExtractor={(item) => item.id}
          overScrollMode="never"
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>{t("forms.nearby.sectionTitle")}</Text>
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: HEADER_HEIGHT + index * ROW_HEIGHT,
            index,
          })}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, HEADER_HEIGHT + index * ROW_HEIGHT),
              animated: true,
            });
          }}
          renderItem={({ item }) => {
            const isSelected = isSameRestaurantDraft(selected, item);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => selectRestaurant(item)}
                style={({ pressed }) => [
                  styles.row,
                  isSelected && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.city ? (
                    <Text style={styles.rowSubtitle}>{item.city}</Text>
                  ) : null}
                </View>
                {isSelected ? (
                  <SelectionCheckmark />
                ) : item.distanceMeters != null ? (
                  <Text style={styles.distance}>
                    {formattedDistance(item.distanceMeters)}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <TabBarBottomFade />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  flexFill: {
    flex: 1,
  },
  bannerPad: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 20,
    paddingBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Theme.spacing.listRowHorizontal,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(236, 227, 207, 0.35)',
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Theme.spacing.listRowHorizontal,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  fallbackText: {
    ...captionTextStyle,
    flex: 1,
    fontSize: 13,
    color: GustraColors.forestGreen,
  },
  loadingText: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.65)',
  },
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 8,
  },
  sectionTitle: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    marginTop: 4,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(35, 32, 26, 0.1)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.35)',
  },
  rowSelected: {
    backgroundColor: 'rgba(36, 78, 57, 0.1)',
  },
  rowPressed: {
    backgroundColor: 'rgba(236, 227, 207, 0.7)',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
  },
  rowSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  distance: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
});
