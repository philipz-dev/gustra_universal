import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatList as FlatListType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';

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
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
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
  regionCodeForCountry,
  restaurantDraftFromResult,
  searchNearby,
  searchText,
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
  const { reviews, restaurants, addDraftToBucketList, setRestaurantBucket } =
    useReviewsStore();
  const mapRef = useRef<GoogleMapsViewHandle>(null);
  const listRef = useRef<FlatListType<RestaurantSearchResult>>(null);
  const searchTaskRef = useRef(0);
  const suppressIdleRef = useRef(0);
  const ignoreNextMapPressRef = useRef(false);
  const initialSearchStartedRef = useRef(false);
  const searchCenterRef = useRef<LatLng>(FALLBACK_MAP_CENTER);
  const searchRadiusRef = useRef(DEFAULT_SEARCH_RADIUS_M);
  const lastSearchedCenterRef = useRef<LatLng | null>(null);
  const lastSearchedRadiusRef = useRef(DEFAULT_SEARCH_RADIUS_M);

  const [selected, setSelected] = useState<RestaurantDraft | null>(null);
  const [results, setResults] = useState<RestaurantSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [query, setQuery] = useState('');
  const [isTextSearching, setIsTextSearching] = useState(false);
  const [textSearchError, setTextSearchError] = useState<string | null>(null);
  /** Non-null while a text search result is on screen. */
  const textSearchActiveRef = useRef<LatLng | null>(null);

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

  // Location resolution runs once at mount so the blue dot is available before
  // the WebView reports ready (the map only injects it if userLocation is set).
  const [locationResolved, setLocationResolved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const location = await resolveCurrentLocation();
      if (cancelled) return;
      if (location.coords) setUserLocation(location.coords);
      setLocationResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once the map is ready and the initial location pass finished, point the
  // camera at the user (or the wide fallback) and run the first nearby search.
  useEffect(() => {
    if (!mapReady || !locationResolved) return;
    initialSearchStartedRef.current = true;
    if (userLocation) {
      searchCenterRef.current = userLocation;
      searchRadiusRef.current = DEFAULT_SEARCH_RADIUS_M;
      moveCameraProgrammatically(userLocation, 14, 2);
      const timer = setTimeout(() => {
        void performSearch(userLocation, DEFAULT_SEARCH_RADIUS_M);
      }, 300);
      return () => clearTimeout(timer);
    }
    // Permission denied / no fix: wide fallback, no silent Middelkerke search.
    moveCameraProgrammatically(FALLBACK_MAP_CENTER, 6, 2);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, locationResolved, userLocation]);

  const handleMapIdle = useCallback((center: LatLng, radius: number) => {
    searchCenterRef.current = center;
    searchRadiusRef.current = radius;

    if (suppressIdleRef.current > 0) {
      suppressIdleRef.current -= 1;
      return;
    }

    // A text search result moved the camera — only panning away from it
    // returns to the normal "search this area" flow.
    if (textSearchActiveRef.current) {
      const left = isSignificantRegionChange(
        center,
        radius,
        textSearchActiveRef.current,
        Math.max(radius, DEFAULT_SEARCH_RADIUS_M),
      );
      if (!left) return;
      textSearchActiveRef.current = null;
    }

    if (!initialSearchStartedRef.current || !lastSearchedCenterRef.current) {
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

  const clearTextSearch = useCallback(() => {
    textSearchActiveRef.current = null;
    setQuery('');
    setTextSearchError(null);
  }, []);

  const runTextSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isTextSearching) return;
    Keyboard.dismiss();
    const gen = ++searchTaskRef.current;
    setTextSearchError(null);
    setIsTextSearching(true);
    try {
      // No GPS bias: an explicit place in the query (e.g. "Frankfurt") wins
      // over the device circle, so a text search can jump anywhere. Region
      // code keeps Places results inside the matching country (a bare city
      // name like "Brussel" otherwise returns city-level POIs that our
      // food allowlist then filters out).
      const countryCode = regionCodeForCountry(trimmed);
      let found = await searchText(trimmed, null, {
        locationBias: false,
        regionCode: countryCode,
      });
      if (gen !== searchTaskRef.current) return;
      // A bare city name ("Brussel") often returns no dining venues from the
      // strict allowlist. Retry once with a dining qualifier so the user still
      // gets restaurants for that city.
      if (found.length === 0 && !countryCode) {
        found = await searchText(`${trimmed} restaurant`, null, {
          locationBias: false,
        });
        if (gen !== searchTaskRef.current) return;
      }
      setResults(found);
      lastSearchedCenterRef.current = null;
      lastSearchedRadiusRef.current = 0;
      if (found.length > 0) {
        const target = found[0]!.coordinate;
        textSearchActiveRef.current = target;
        setShowSearchThisArea(false);
        moveCameraProgrammatically(target, 14, 1);
      } else {
        textSearchActiveRef.current = null;
      }
    } catch (error) {
      if (gen !== searchTaskRef.current) return;
      setTextSearchError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      if (gen === searchTaskRef.current) {
        setIsTextSearching(false);
      }
    }
  }, [isTextSearching, moveCameraProgrammatically, query, regionCodeForCountry, searchText]);

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

      <View style={styles.searchBarPad}>
        <View style={styles.searchBarRow}>
          {Platform.OS === 'ios' ? (
            <SymbolView
              name="magnifyingglass"
              size={18}
              tintColor="rgba(35, 32, 26, 0.4)"
              weight="semibold"
            />
          ) : (
            <MaterialIcons
              name="search"
              size={20}
              color="rgba(35, 32, 26, 0.4)"
            />
          )}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('forms.mapSearch.searchPlaceholder')}
            placeholderTextColor="rgba(35, 32, 26, 0.4)"
            style={styles.searchInput}
            keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => void runTextSearch()}
            accessibilityLabel={t('forms.mapSearch.searchPlaceholder')}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              hitSlop={8}
              onPress={clearTextSearch}
              style={({ pressed }) => pressed && styles.searchClearPressed}>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="xmark.circle.fill"
                  size={18}
                  tintColor="rgba(35, 32, 26, 0.35)"
                />
              ) : (
                <MaterialIcons
                  name="cancel"
                  size={20}
                  color="rgba(35, 32, 26, 0.35)"
                />
              )}
            </Pressable>
          ) : null}
        </View>
        {isTextSearching ? (
          <ActivityIndicator color={GustraColors.forestGreen} size="small" />
        ) : textSearchError ? (
          <Text style={styles.searchError}>{textSearchError}</Text>
        ) : null}
      </View>

      {selected ? (
        <View style={styles.bannerPad}>
          <SelectedRestaurantBanner
            draft={selected}
            actionTitle={t("forms.mapSearch.startReview")}
            visitedCount={selectedVisitedCount}
            onToggleBucketList={handleToggleBucketList}
            inBucketList={selectedInBucketList}
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
        keyboardDismissMode="on-drag"
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
          ) : textSearchActiveRef.current || query.trim() ? (
            <View style={styles.flexFill}>
              <HouseEmptyState
                title={t('forms.mapSearch.emptyTitle')}
                description={t('forms.mapSearch.searchEmpty', {
                  query: query.trim(),
                })}
                systemImage="magnifyingglass"
                androidImage="search_off"
              />
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
  searchBarPad: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 12,
    gap: 8,
    backgroundColor: GustraColors.cream,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.12)',
  },
  searchInput: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
    paddingVertical: Platform.OS === 'android' ? 10 : 0,
    minHeight: 46,
  },
  searchClearPressed: {
    opacity: 0.6,
  },
  searchError: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(166, 62, 36, 0.95)',
    paddingHorizontal: 4,
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
