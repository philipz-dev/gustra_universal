import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveFilterSummary } from '@/components/feed/ActiveFilterSummary';
import { FilterOptionsModal } from '@/components/feed/FilterOptionsModal';
import { type FeedFilterState } from '@/components/feed/feedFilters';
import {
  GoogleMapsView,
  type GoogleMapMarker,
  type GoogleMapsViewHandle,
} from '@/components/map/GoogleMapsView';
import { houseAlert } from '@/components/ui/HouseAlert';
import { HouseErrorBoundary } from '@/components/ui/HouseErrorBoundary';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import {
  SERIF_FONT,
  Theme,
  bodyTextStyle,
  captionTextStyle,
} from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import { Haptics } from '@/services/haptics';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useSharedRestaurantFilters } from '@/hooks/useSharedRestaurantFilters';
import {
  openSystemSettings,
  resolveCurrentLocation,
} from '@/services/location/resolveCurrentLocation';
import { FALLBACK_MAP_CENTER, type LatLng } from '@/services/places';

/** Own reviews — bright green (pops on parks/water/roads; clearly the user's own pins). */
const OWN_PIN_COLOR = GustraColors.mapOwnPin;
/** Friends' reviews — map blue. */
const FRIENDS_PIN_COLOR = GustraColors.mapFriendsPin;

/** Survives push/pop to review detail so Back restores the same map view. */
type MemoriesMapCamera = { center: LatLng; zoom: number };
let savedMemoriesMapCamera: MemoriesMapCamera | null = null;

type MapPin = {
  reviewId: string;
  name: string;
  coordinate: LatLng;
  isFriend: boolean;
};

function hasCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export default function MemoriesMapScreen() {
  const { t } = useAppTranslation();
  return (
    <HouseErrorBoundary
      fallbackTitle={t('tabs.map') || 'Mijn kaart'}
      fallbackMessage="We konden de kaart op dit moment niet laden. Probeer het scherm opnieuw te openen."
    >
      <MemoriesMapContent />
    </HouseErrorBoundary>
  );
}

/**
 * My map — pins by ownership (own = bright green, friends = blue).
 * Same shared filter state as Reviews / My Gustra (Sort by ignored here).
 */
function MemoriesMapContent() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reviews, getRestaurant, ready } = useReviewsStore();
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
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const mapRef = useRef<GoogleMapsViewHandle>(null);
  const pendingFitRef = useRef(false);
  /** Snapshot at mount — module cache may update while this screen is mounted. */
  const restoredCameraRef = useRef(savedMemoriesMapCamera);

  const allowedRestaurantIds = useMemo(
    () => new Set(filteredSummaries.map((s) => s.restaurantId)),
    [filteredSummaries],
  );

  useEffect(() => {
    if (!canFilter) setFilterModalVisible(false);
  }, [canFilter]);

  const pins = useMemo((): MapPin[] => {
    if (!ready) return [];
    return reviews
      .filter((review) => {
        if (review.origin === 'own') return true;
        return includeFriends && review.origin === 'imported';
      })
      .filter((review) => allowedRestaurantIds.has(review.restaurantId))
      .flatMap((review) => {
        const restaurant = getRestaurant(review.restaurantId);
        if (!restaurant) return [];
        if (!hasCoordinates(restaurant.latitude, restaurant.longitude)) {
          return [];
        }
        return [
          {
            reviewId: review.id,
            name: restaurant.name,
            coordinate: {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            },
            isFriend: review.origin === 'imported',
          },
        ];
      });
  }, [allowedRestaurantIds, getRestaurant, includeFriends, ready, reviews]);

  const markers = useMemo(
    (): GoogleMapMarker[] =>
      pins.map((pin) => ({
        id: pin.reviewId,
        coordinate: pin.coordinate,
        title: pin.isFriend
          ? `${pin.name} ${t('map.friendSuffix')}`
          : pin.name,
        color: pin.isFriend ? FRIENDS_PIN_COLOR : OWN_PIN_COLOR,
      })),
    [pins, t],
  );

  useEffect(() => {
    if (!pendingFitRef.current) return;
    pendingFitRef.current = false;
    if (pins.length === 0) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToMarkers(56);
    }, 80);
    return () => clearTimeout(timer);
  }, [pins]);

  const applyFiltersAndFit = useCallback(
    (next: FeedFilterState) => {
      pendingFitRef.current = true;
      setFilterState(next);
    },
    [setFilterState],
  );

  const resetFiltersAndFit = useCallback(() => {
    pendingFitRef.current = true;
    resetFilterState();
  }, [resetFilterState]);

  const initialCenter = useMemo(() => {
    if (restoredCameraRef.current) return restoredCameraRef.current.center;
    if (pins.length > 0) return pins[0]!.coordinate;
    if (userLocation) return userLocation;
    return FALLBACK_MAP_CENTER;
  }, [pins, userLocation]);

  const initialZoom = restoredCameraRef.current
    ? restoredCameraRef.current.zoom
    : pins.length === 0 && userLocation
      ? 13
      : 11;

  const shouldAutoFit = restoredCameraRef.current == null;

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + Math.max(insets.bottom, 8);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const location = await resolveCurrentLocation();
      if (!cancelled && location.coords) {
        setUserLocation(location.coords);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recenterOnUser = async () => {
    if (locating) return;
    Haptics.selectionChanged();
    setLocating(true);
    try {
      const location = await resolveCurrentLocation();
      if (location.coords) {
        setUserLocation(location.coords);
        mapRef.current?.animateTo(location.coords, 15);
        return;
      }
      if (location.isAuthorizationDenied) {
        houseAlert(
          t('alerts.location.deniedTitle'),
          location.error ?? t('alerts.location.deniedBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.openSettings'),
              onPress: () => openSystemSettings(),
            },
          ],
        );
        return;
      }
      houseAlert(
        t('alerts.location.deniedTitle'),
        location.error ?? t('alerts.location.unavailable'),
      );
    } finally {
      setLocating(false);
    }
  };

  const onAddReview = () => {
    Haptics.light();
    router.push('/add-review');
  };

  const ownPinsEmpty = useMemo(
    () =>
      !ready ||
      !reviews.some((review) => {
        if (review.origin !== 'own') return false;
        const restaurant = getRestaurant(review.restaurantId);
        return (
          restaurant != null &&
          hasCoordinates(restaurant.latitude, restaurant.longitude)
        );
      }),
    [getRestaurant, ready, reviews],
  );

  const friendPinsUnfiltered = useMemo(
    () =>
      includeFriends &&
      reviews.some((review) => {
        if (review.origin !== 'imported') return false;
        const restaurant = getRestaurant(review.restaurantId);
        return (
          restaurant != null &&
          hasCoordinates(restaurant.latitude, restaurant.longitude)
        );
      }),
    [getRestaurant, includeFriends, reviews],
  );

  const noFilterMatches = filterActive && pins.length === 0;
  const showEmptyMemories =
    !filterActive && ownPinsEmpty && !friendPinsUnfiltered;

  return (
    <View style={styles.screen}>
      <ReviewsHeader
        title={t('map.title')}
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
        onChange={applyFiltersAndFit}
        containerStyle={styles.filterGap}
      />
      <View style={styles.mapBody}>
        <GoogleMapsView
          ref={mapRef}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          markers={markers}
          showsUserLocation
          userLocation={userLocation}
          fitToMarkers={
            shouldAutoFit && (pins.length > 0 || userLocation != null)
          }
          fitIncludeCoordinate={userLocation}
          mapPaddingBottom={bottomPad}
          onIdle={(center, _radius, zoom) => {
            savedMemoriesMapCamera = { center, zoom };
          }}
          onMarkerPress={(id) => {
            Haptics.selectionChanged();
            router.push(`/map/review/${id}`);
          }}
        />

        <View style={styles.legendWrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: legendExpanded }}
            accessibilityLabel={t('a11y.mapLegend')}
            onPress={() => {
              Haptics.selectionChanged();
              setLegendExpanded((v) => !v);
            }}
            style={({ pressed }) => [
              styles.legendCard,
              pressed && styles.pressed,
            ]}>
            <View style={styles.legendHeader}>
              <Text style={styles.legendTitle}>{t('map.legend.title')}</Text>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name={legendExpanded ? 'chevron.up' : 'chevron.down'}
                  size={12}
                  tintColor="rgba(35, 32, 26, 0.55)"
                />
              ) : (
                <MaterialIcons
                  name={legendExpanded ? 'expand-less' : 'expand-more'}
                  size={18}
                  color="rgba(35, 32, 26, 0.55)"
                />
              )}
            </View>
            {legendExpanded ? (
              <View style={styles.legendRows}>
                <View style={styles.legendRow}>
                  <View
                    style={[styles.legendDot, { backgroundColor: OWN_PIN_COLOR }]}
                  />
                  <Text style={styles.legendLabel}>{t('map.legend.own')}</Text>
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: FRIENDS_PIN_COLOR },
                    ]}
                  />
                  <Text style={styles.legendLabel}>
                    {t('map.legend.friends')}
                  </Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View
          style={[styles.mapControls, { bottom: bottomPad + 12 }]}
          pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.myLocation')}
            onPress={() => {
              void recenterOnUser();
            }}
            style={({ pressed }) => [
              styles.mapControlBtn,
              pressed && styles.pressed,
            ]}>
            {locating ? (
              <ActivityIndicator size="small" color={GustraColors.forestGreen} />
            ) : Platform.OS === 'ios' ? (
              <SymbolView
                name="location.fill"
                size={20}
                tintColor={GustraColors.forestGreen}
              />
            ) : (
              <MaterialIcons
                name="my-location"
                size={22}
                color={GustraColors.forestGreen}
              />
            )}
          </Pressable>
        </View>

        {noFilterMatches ? (
          <View
            style={[styles.emptyCardWrap, { paddingBottom: bottomPad }]}
            pointerEvents="box-none">
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('map.empty.noMatchesTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('map.empty.noMatchesBody')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('map.empty.clearFilters')}
                onPress={resetFiltersAndFit}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.addLabel}>{t('map.empty.clearFilters')}</Text>
              </Pressable>
            </View>
          </View>
        ) : showEmptyMemories ? (
          <View
            style={[styles.emptyCardWrap, { paddingBottom: bottomPad }]}
            pointerEvents="box-none">
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('map.empty.noMemoriesTitle')}</Text>
              <Text style={styles.emptyBody}>
                {t('map.empty.noMemoriesBody')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('map.empty.addReview')}
                onPress={onAddReview}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="plus.circle.fill"
                    size={18}
                    tintColor="#FFFFFF"
                  />
                ) : (
                  <MaterialIcons name="add-circle" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.addLabel}>{t('map.empty.addReview')}</Text>
              </Pressable>
            </View>
          </View>
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
        hideSort
        showFriendsFilter={showFriendsFilter}
        onApply={applyFiltersAndFit}
        onReset={resetFiltersAndFit}
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
  /** Gap between the green banner and the filter chips (no search bar here). */
  filterGap: {
    backgroundColor: GustraColors.cream,
    paddingTop: Theme.spacing.searchVertical,
  },
  mapBody: {
    flex: 1,
  },
  legendWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    maxWidth: 220,
  },
  legendCard: {
    backgroundColor: 'rgba(245, 238, 221, 0.96)',
    borderRadius: Theme.radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(36, 78, 57, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    ...Theme.overlayShadow,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendTitle: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  legendRows: {
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.75)',
    flexShrink: 1,
  },
  mapControls: {
    position: 'absolute',
    right: 12,
    zIndex: 2,
    alignItems: 'center',
  },
  mapControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 238, 221, 0.96)',
    borderWidth: 1.5,
    borderColor: 'rgba(36, 78, 57, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.overlayShadow,
  },
  emptyCardWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 15,
    color: GustraColors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.7)',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GustraColors.forestGreen,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addLabel: {
    ...bodyTextStyle,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
  },
});
