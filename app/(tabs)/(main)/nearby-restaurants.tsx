import { useCallback, useEffect, useRef, useState } from 'react';
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

import { SelectedRestaurantBanner } from '@/components/review/SelectedRestaurantBanner';
import { SelectionCheckmark } from '@/components/review/SelectionCheckmark';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';
import {
  openSystemSettings,
  resolveCurrentLocation,
} from '@/services/location/resolveCurrentLocation';
import {
  formattedDistance,
  isSameRestaurantDraft,
  restaurantDraftFromResult,
  searchNearby,
  type RestaurantDraft,
  type RestaurantSearchResult,
} from '@/services/places';

/**
 * Nearby restaurant picker (Swift `NearbyRestaurantSelectionView`).
 * Selecting a place shows the Start Review banner; review form comes later.
 */
export default function NearbyRestaurantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatListType<RestaurantSearchResult>>(null);
  const [selected, setSelected] = useState<RestaurantDraft | null>(null);
  const [results, setResults] = useState<RestaurantSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOpenSettings, setShowOpenSettings] = useState(false);

  const loadNearby = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setShowOpenSettings(false);
    setResults([]);

    const location = await resolveCurrentLocation();
    if (!location.coords) {
      setIsLoading(false);
      setShowOpenSettings(location.isAuthorizationDenied);
      setErrorMessage(location.error ?? 'Current location unavailable.');
      return;
    }

    try {
      const found = await searchNearby(location.coords);
      setResults(found);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not reach the restaurant search service.',
      );
    }
  }, []);

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
            actionTitle="Start Review"
            onAction={() =>
              router.push({
                pathname: '/review-form',
                params: { draft: JSON.stringify(selected) },
              })
            }
          />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={GustraColors.forestGreen} />
          <Text style={styles.loadingText}>Finding nearby restaurants…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.flexFill}>
          <HouseEmptyState
            title="Couldn't load nearby places"
            description={errorMessage}
            systemImage="location.slash"
            androidImage="location_off"
            actionTitle={showOpenSettings ? 'Open Settings' : 'Try Again'}
            onAction={() => {
              if (showOpenSettings) {
                openSystemSettings();
              } else {
                void loadNearby();
              }
            }}
          />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.flexFill}>
          <HouseEmptyState
            title="No nearby restaurants found."
            description="Try again or search on the map instead."
            systemImage="mappin.and.ellipse"
            androidImage="place"
            actionTitle="Search Nearby"
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
            <Text style={styles.sectionTitle}>Nearby Restaurants</Text>
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, index * 64),
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
