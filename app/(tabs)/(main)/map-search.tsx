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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  GoogleMapsView,
  type GoogleMapsViewHandle,
} from '@/components/map/GoogleMapsView';
import { SelectedRestaurantBanner } from '@/components/review/SelectedRestaurantBanner';
import { SelectionCheckmark } from '@/components/review/SelectionCheckmark';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { TabBarBottomFade } from '@/components/ui/TabBarBottomFade';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import { resolveReviewOrigin } from '@/data/types';
import { Haptics } from '@/services/haptics';
import { resolveCurrentLocation } from '@/services/location/resolveCurrentLocation';
import {
  DEFAULT_SEARCH_RADIUS_M,
  FALLBACK_MAP_CENTER,
  findExistingRestaurant,
  formattedDistance,
  isSameRestaurantDraft,
  isSignificantRegionChange,
  restaurantDraftFromResult,
  searchNearby,
  type LatLng,
  type RestaurantDraft,
  type RestaurantSearchResult,
} from '@/services/places';
import { useAppTranslation } from '@/hooks/useAppTranslation';

/** Fixed row height for the results list (paddingVertical 14 ×2 + two lines). */
const ROW_HEIGHT = 64;

/**
 * Map restaurant search (Swift `MapSearchView`).
 * Uses Google Maps JavaScript API (works in Expo Go with our API key).
 */
export default function MapSearchScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reviews, restaurants } = useReviewsStore();
  const mapRef = useRef<GoogleMapsViewHandle>(null);
  const listRef = useRef<FlatListType<RestaurantSearchResult>>(null);
  const searchTaskRef = useRef(0);
  const suppressIdleRef = useRef(0);
  const ignoreNextMapPressRef = useRef(false);
  const hasLoadedInitialRef = useRef(false);
  const searchCenterRef = useRef<LatLng>(FALLBACK_MAP_CENTER);
  const searchRadiusRef = useRef(DEFAULT_SEARCH_RADIUS_M);
  const lastSearchedCenterRef = useRef<LatLng | null>(null);
  const lastSearchedRadiusRef = useRef(DEFAULT_SEARCH_RADIUS_M);

  const [selected, setSelected] = useState<RestaurantDraft | null>(null);
  const [results, setResults] = useState<RestaurantSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const performSearch = useCallback(async (center: LatLng, radius: number) => {
    const taskId = ++searchTaskRef.current;
    setIsLoading(true);
    setShowSearchThisArea(false);
    try {
      const found = await searchNearby(center, radius);
      if (taskId !== searchTaskRef.current) return;
      setResults(found);
      lastSearchedCenterRef.current = center;
      lastSearchedRadiusRef.current = radius;
    } catch {
      if (taskId !== searchTaskRef.current) return;
      setResults([]);
      lastSearchedCenterRef.current = center;
      lastSearchedRadiusRef.current = radius;
    } finally {
      if (taskId === searchTaskRef.current) {
        setIsLoading(false);
        setShowSearchThisArea(false);
      }
    }
  }, []);

  const moveCameraProgrammatically = useCallback(
    (center: LatLng, zoom = 14, suppressIdleCount = 1) => {
      suppressIdleRef.current += suppressIdleCount;
      searchCenterRef.current = center;
      mapRef.current?.animateTo(center, zoom);
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    if (hasLoadedInitialRef.current || !mapReady) return;
    hasLoadedInitialRef.current = true;

    const location = await resolveCurrentLocation();
    if (location.coords) {
      const coords = location.coords;
      setUserLocation(coords);
      searchCenterRef.current = coords;
      searchRadiusRef.current = DEFAULT_SEARCH_RADIUS_M;
      moveCameraProgrammatically(coords, 14, 2);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await performSearch(coords, DEFAULT_SEARCH_RADIUS_M);
      return;
    }

    // Permission denied / no fix: wide fallback, no silent Middelkerke search.
    moveCameraProgrammatically(FALLBACK_MAP_CENTER, 6, 2);
  }, [mapReady, moveCameraProgrammatically, performSearch]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleMapIdle = useCallback((center: LatLng, radius: number) => {
    searchCenterRef.current = center;
    searchRadiusRef.current = radius;

    if (suppressIdleRef.current > 0) {
      suppressIdleRef.current -= 1;
      return;
    }

    if (!hasLoadedInitialRef.current || !lastSearchedCenterRef.current) {
      return;
    }

    setShowSearchThisArea(
      isSignificantRegionChange(
        center,
        radius,
        lastSearchedCenterRef.current,
        lastSearchedRadiusRef.current,
      ),
    );
  }, []);

  const searchThisArea = () => {
    setShowSearchThisArea(false);
    void performSearch(searchCenterRef.current, searchRadiusRef.current);
  };

  const clearSelection = () => setSelected(null);

  const selectedVisitedCount = useMemo(() => {
    if (!selected) return 0;
    const existing = findExistingRestaurant(selected, restaurants);
    if (!existing) return 0;
    return reviews.filter(
      (r) =>
        r.restaurantId === existing.id && resolveReviewOrigin(r) === 'own',
    ).length;
  }, [reviews, restaurants, selected]);

  const selectDraft = (draft: RestaurantDraft) => {
    ignoreNextMapPressRef.current = true;
    if (isSameRestaurantDraft(selected, draft)) {
      clearSelection();
      return;
    }
    Haptics.selectionChanged();
    setSelected(draft);
    moveCameraProgrammatically(
      { latitude: draft.latitude, longitude: draft.longitude },
      15,
    );
    const index = results.findIndex((item) =>
      isSameRestaurantDraft(draft, item),
    );
    if (index >= 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.15,
        });
      });
    }
  };

  const sortedResults = useMemo(() => {
    if (!selected) return results;
    return [...results].sort((a, b) => {
      const aSel = isSameRestaurantDraft(selected, a) ? 0 : 1;
      const bSel = isSameRestaurantDraft(selected, b) ? 0 : 1;
      return aSel - bSel;
    });
  }, [results, selected]);

  const mapMarkers = useMemo(
    () =>
      results.map((item) => ({
        id: item.id,
        coordinate: item.coordinate,
        title: item.name,
        isSelected: isSameRestaurantDraft(selected, item),
      })),
    [results, selected],
  );

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 16;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t("forms.mapSearch.title")}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.mapWrap}>
        <GoogleMapsView
          ref={mapRef}
          initialCenter={FALLBACK_MAP_CENTER}
          initialZoom={14}
          markers={mapMarkers}
          showsUserLocation
          userLocation={userLocation}
          onReady={() => setMapReady(true)}
          onIdle={handleMapIdle}
          onMarkerPress={(id) => {
            const item = results.find((result) => result.id === id);
            if (!item) return;
            selectDraft(restaurantDraftFromResult(item));
          }}
          onMapPress={() => {
            if (ignoreNextMapPressRef.current) {
              ignoreNextMapPressRef.current = false;
              return;
            }
            clearSelection();
          }}
        />

        {isLoading ? (
          <View style={styles.mapChip} pointerEvents="none">
            <ActivityIndicator color={GustraColors.forestGreen} size="small" />
            <Text style={styles.mapChipText}>{t("forms.manual.loading")}</Text>
          </View>
        ) : null}

        {showSearchThisArea && !isLoading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("forms.mapSearch.searchArea")}
            accessibilityHint={t("forms.mapSearch.searchAreaHint")}
            onPress={searchThisArea}
            style={({ pressed }) => [
              styles.searchAreaButton,
              pressed && styles.searchAreaPressed,
            ]}>
            <MaterialIcons name="refresh" color="#FFFFFF" size={18} />
            <Text style={styles.searchAreaLabel}>
              {t('forms.mapSearch.searchArea')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {selected ? (
        <View style={styles.bannerPad}>
          <SelectedRestaurantBanner
            draft={selected}
            actionTitle={t("forms.mapSearch.startReview")}
            visitedCount={selectedVisitedCount}
            onClear={clearSelection}
            onAction={() =>
              router.push({
                pathname: '/review-form',
                params: { draft: JSON.stringify(selected) },
              })
            }
          />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        style={styles.listFlex}
        data={sortedResults}
        keyExtractor={(item) => item.id}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, index * ROW_HEIGHT),
            animated: true,
          });
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={GustraColors.forestGreen} />
              <Text style={styles.loadingText}>
                {t("forms.nearby.finding")}
              </Text>
            </View>
          ) : (
            <View style={styles.flexFill}>
              <HouseEmptyState
                title={t('forms.mapSearch.emptyTitle')}
                description={t('forms.mapSearch.hint')}
                systemImage="magnifyingglass"
                androidImage="search_off"
              />
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const isSelected = isSameRestaurantDraft(selected, item);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => selectDraft(restaurantDraftFromResult(item))}
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

      <TabBarBottomFade />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  mapWrap: {
    height: 280,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    overflow: 'hidden',
  },
  mapChip: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 238, 221, 0.94)',
  },
  mapChipText: {
    ...bodyTextStyle,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(35, 32, 26, 0.75)',
  },
  searchAreaButton: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GustraColors.forestGreen,
    ...Theme.overlayShadow,
  },
  searchAreaPressed: {
    opacity: 0.88,
  },
  searchAreaLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerPad: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingVertical: 12,
    backgroundColor: GustraColors.cream,
  },
  listFlex: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(236, 227, 207, 0.35)',
  },
  loadingText: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.65)',
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
