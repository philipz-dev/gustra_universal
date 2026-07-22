import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GoogleMapsView,
  type GoogleMapMarker,
} from '@/components/map/GoogleMapsView';
import { GustraColors } from '@/constants/Colors';
import {
  SERIF_FONT,
  Theme,
  bodyTextStyle,
  captionTextStyle,
} from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import {
  satisfactionFromScore,
  type Review,
  type SatisfactionLevel,
} from '@/data/types';
import { Haptics } from '@/services/haptics';
import { resolveCurrentLocation } from '@/services/location/resolveCurrentLocation';
import { FALLBACK_MAP_CENTER, type LatLng } from '@/services/places';
import { overallScoreFromCriteria } from '@/services/reviews/ratings';

const LEVEL_COLOR: Record<SatisfactionLevel, string> = {
  excellent: GustraColors.ratingExcellent,
  neutral: GustraColors.ratingNeutral,
  avoid: GustraColors.ratingAvoid,
};

/** Distinct purple pin color for friends' reviews. */
const FRIENDS_PIN_COLOR = '#7B5EA7';

const SHOW_FRIENDS_KEY = 'gustra.map.showFriendsReviews';

type MapPin = {
  reviewId: string;
  name: string;
  coordinate: LatLng;
  level: SatisfactionLevel;
  isFriend: boolean;
};

function hasCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

function scoreForEnabled(review: Review, enabledIds: Set<string>): number {
  return overallScoreFromCriteria(
    review.criteria.filter((c) => enabledIds.has(c.id)),
  );
}

/**
 * My map — own-review pins colored by satisfaction (Swift `MemoriesMapView`),
 * with an optional discreet Friends overlay.
 */
export default function MemoriesMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reviews, getRestaurant, ready, hasFriendReviews } = useReviewsStore();
  const { enabledCriteria } = useCriteriaSettings();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [showFriends, setShowFriends] = useState(false);

  const enabledIds = useMemo(
    () => new Set(enabledCriteria.map((c) => c.id)),
    [enabledCriteria],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SHOW_FRIENDS_KEY);
        if (!cancelled && raw === 'true') setShowFriends(true);
      } catch {
        // keep default off
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pins = useMemo((): MapPin[] => {
    if (!ready) return [];
    return reviews
      .filter((review) => {
        if (review.origin === 'own') return true;
        return showFriends && review.origin === 'imported';
      })
      .flatMap((review) => {
        const restaurant = getRestaurant(review.restaurantId);
        if (!restaurant) return [];
        if (!hasCoordinates(restaurant.latitude, restaurant.longitude)) {
          return [];
        }
        const score = scoreForEnabled(review, enabledIds);
        return [
          {
            reviewId: review.id,
            name: restaurant.name,
            coordinate: {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            },
            level: satisfactionFromScore(score),
            isFriend: review.origin === 'imported',
          },
        ];
      });
  }, [enabledIds, getRestaurant, ready, reviews, showFriends]);

  const markers = useMemo(
    (): GoogleMapMarker[] =>
      pins.map((pin) => ({
        id: pin.reviewId,
        coordinate: pin.coordinate,
        title: pin.isFriend ? `${pin.name} (friend)` : pin.name,
        color: pin.isFriend ? FRIENDS_PIN_COLOR : LEVEL_COLOR[pin.level],
      })),
    [pins],
  );

  const initialCenter = useMemo(() => {
    if (pins.length > 0) return pins[0]!.coordinate;
    if (userLocation) return userLocation;
    return FALLBACK_MAP_CENTER;
  }, [pins, userLocation]);

  const initialZoom = pins.length === 0 && userLocation ? 13 : 11;

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

  const toggleFriends = () => {
    Haptics.selectionChanged();
    setShowFriends((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(SHOW_FRIENDS_KEY, next ? 'true' : 'false');
      return next;
    });
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

  return (
    <View style={styles.screen}>
      <GoogleMapsView
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        markers={markers}
        showsUserLocation
        userLocation={userLocation}
        fitToMarkers={pins.length > 0 || userLocation != null}
        fitIncludeCoordinate={userLocation}
        mapPaddingBottom={bottomPad}
        onMarkerPress={(id) => {
          Haptics.selectionChanged();
          router.push(`/review/${id}`);
        }}
      />

      {hasFriendReviews ? (
        <View style={styles.friendsToggleWrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: showFriends }}
            accessibilityLabel="Show Friend's reviews on map"
            accessibilityHint={
              showFriends
                ? "Friend's reviews are visible. Double tap to hide."
                : "Friend's reviews are hidden. Double tap to show."
            }
            onPress={toggleFriends}
            style={({ pressed }) => [
              styles.friendsToggle,
              showFriends ? styles.friendsToggleOn : styles.friendsToggleOff,
              pressed && styles.pressed,
            ]}>
            <Text
              style={[
                styles.friendsLabel,
                showFriends ? styles.friendsLabelOn : styles.friendsLabelOff,
              ]}>
              Friend's reviews
            </Text>
            <View
              style={[
                styles.switchTrack,
                showFriends ? styles.switchTrackOn : styles.switchTrackOff,
              ]}>
              <View
                style={[
                  styles.switchKnob,
                  showFriends ? styles.switchKnobOn : styles.switchKnobOff,
                ]}
              />
            </View>
            <Text
              style={[
                styles.friendsState,
                showFriends ? styles.friendsStateOn : styles.friendsStateOff,
              ]}>
              {showFriends ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {ownPinsEmpty && !(showFriends && pins.length > 0) ? (
        <View
          style={[styles.emptyCardWrap, { paddingBottom: bottomPad }]}
          pointerEvents="box-none">
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Map Memories Yet</Text>
            <Text style={styles.emptyBody}>
              Reviews linked to a map location appear here as colored pins.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add Review"
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
              <Text style={styles.addLabel}>Add Review</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  friendsToggleWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  friendsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: Theme.radius.lg,
    borderWidth: 1.5,
    // Soft cream fill reads over map tiles; green border anchors house style.
    backgroundColor: 'rgba(245, 238, 221, 0.94)',
    borderColor: 'rgba(36, 78, 57, 0.45)',
    shadowColor: GustraColors.forestGreen,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  friendsToggleOff: {
    borderColor: 'rgba(36, 78, 57, 0.35)',
    backgroundColor: 'rgba(245, 238, 221, 0.94)',
  },
  friendsToggleOn: {
    borderColor: GustraColors.forestGreen,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
  },
  friendsLabel: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '700',
  },
  friendsLabelOff: {
    color: 'rgba(36, 78, 57, 0.72)',
  },
  friendsLabelOn: {
    color: GustraColors.forestGreen,
  },
  switchTrack: {
    width: 28,
    height: 16,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackOff: {
    backgroundColor: 'rgba(36, 78, 57, 0.22)',
    alignItems: 'flex-start',
  },
  switchTrackOn: {
    backgroundColor: 'rgba(36, 78, 57, 0.4)',
    alignItems: 'flex-end',
  },
  switchKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  switchKnobOff: {
    backgroundColor: 'rgba(36, 78, 57, 0.55)',
  },
  switchKnobOn: {
    backgroundColor: GustraColors.forestGreen,
  },
  friendsState: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 22,
  },
  friendsStateOff: {
    color: 'rgba(36, 78, 57, 0.55)',
  },
  friendsStateOn: {
    color: GustraColors.forestGreen,
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
