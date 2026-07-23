import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import {
  DEFAULT_FEED_FILTER_STATE,
  feedFilterPreviewCount,
  hasFeedFilter,
  isAllSelection,
  placeTypeSelectionSummary,
  selectionSummary,
  sortKindTitle,
  type FeedFilterFlag,
  type FeedFilterOptions,
  type FeedFilterState,
  type FeedSortKind,
} from '@/components/feed/feedFilters';
import { MultiSelectFilterPanel } from '@/components/feed/MultiSelectFilterPanel';
import { SortOptionsPanel } from '@/components/feed/SortOptionsPanel';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { SerifText } from '@/components/ui/SerifText';
import { placeTypeDisplayName } from '@/constants/PlaceTypeLabels';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle, Theme } from '@/constants/Theme';
import type { RestaurantVisitSummary } from '@/data/types';
import { Haptics } from '@/services/haptics';

type PanelRoute = 'location' | 'placeType' | 'sort';

type SortCriterion = { id: string; title: string };

type FilterOptionsModalProps = {
  visible: boolean;
  value: FeedFilterState;
  availableCities: string[];
  availablePrimaryTypes: string[];
  sortCriteria: SortCriterion[];
  sourceSummaries: RestaurantVisitSummary[];
  filterOptions?: FeedFilterOptions;
  onApply: (next: FeedFilterState) => void;
  onReset: () => void;
  onClose: () => void;
};

/** UINavigationController-like ease (no spring / bounce). */
const NAV_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const NAV_DURATION_MS = 320;

/**
 * Filter options sheet (Swift `ReviewFilterPanelView`).
 * Location / cuisine / sort push inside the same sheet.
 */
export function FilterOptionsModal({
  visible,
  value,
  availableCities,
  availablePrimaryTypes,
  sortCriteria,
  sourceSummaries,
  filterOptions,
  onApply,
  onReset,
  onClose,
}: FilterOptionsModalProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FeedFilterState>(value);
  const [panelRoute, setPanelRoute] = useState<PanelRoute | null>(null);
  /** Content kept mounted through the pop animation (avoids Android remount jump). */
  const [activePanel, setActivePanel] = useState<PanelRoute | null>(null);
  const [locationSnapshot, setLocationSnapshot] = useState<string[] | null>(
    null,
  );
  const [placeTypeSnapshot, setPlaceTypeSnapshot] = useState<string[] | null>(
    null,
  );
  // Seed width so the first push never starts at translateX from 0→real width.
  const sheetWidth = useSharedValue(Dimensions.get('window').width);
  const pushProgress = useSharedValue(0);

  const onStackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    // Never resize mid-push — that causes the Android jump.
    if (width > 0 && !panelRoute && !activePanel) {
      sheetWidth.value = width;
    }
  };

  const clearActivePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setDraft({
      ...value,
      locationCities:
        value.locationCities.length === 0
          ? [...availableCities]
          : [...value.locationCities],
      primaryTypes:
        value.primaryTypes.length === 0
          ? [...availablePrimaryTypes]
          : [...value.primaryTypes],
      filters: [...value.filters],
      sortKind: { ...value.sortKind },
    });
    setPanelRoute(null);
    setActivePanel(null);
    setLocationSnapshot(null);
    setPlaceTypeSnapshot(null);
    pushProgress.value = 0;
  }, [visible, value, availableCities, availablePrimaryTypes, pushProgress]);

  useEffect(() => {
    if (panelRoute) {
      // Panel is already mounted via activePanel (set in the same press handler).
      pushProgress.value = withTiming(1, {
        duration: NAV_DURATION_MS,
        easing: NAV_EASING,
      });
      return;
    }
    if (!activePanel) return;
    pushProgress.value = withTiming(
      0,
      { duration: NAV_DURATION_MS, easing: NAV_EASING },
      (finished) => {
        if (finished) {
          runOnJS(clearActivePanel)();
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelRoute]);

  // Calm UIKit-style push: incoming covers from the right; root eases slightly left.
  const rootPageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -sheetWidth.value * 0.3 * pushProgress.value },
    ],
  }));

  const pushedPageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sheetWidth.value * (1 - pushProgress.value) },
    ],
  }));

  const isNoneSelected = draft.filters.length === 0;
  const locationSummary = selectionSummary(
    draft.locationCities,
    availableCities,
  );
  const placeTypeSummary = placeTypeSelectionSummary(
    draft.primaryTypes,
    availablePrimaryTypes,
  );
  const currentSortTitle = sortKindTitle(
    draft.sortKind,
    filterOptions?.criterionTitleFor,
  );

  const matchingCount = useMemo(
    () => feedFilterPreviewCount(sourceSummaries, draft, filterOptions),
    [draft, filterOptions, sourceSummaries],
  );
  const totalCount = sourceSummaries.length;

  const selectNone = () => {
    Haptics.selectionChanged();
    setDraft((prev) => ({ ...prev, filters: [] }));
  };

  const openMultiSelect = (route: 'location' | 'placeType') => {
    Haptics.selectionChanged();
    setDraft((prev) => {
      if (route === 'location') {
        const cities =
          prev.locationCities.length === 0
            ? [...availableCities]
            : prev.locationCities;
        setLocationSnapshot(cities);
        return { ...prev, locationCities: cities };
      }
      const types =
        prev.primaryTypes.length === 0
          ? [...availablePrimaryTypes]
          : prev.primaryTypes;
      setPlaceTypeSnapshot(types);
      return { ...prev, primaryTypes: types };
    });
    // Mount before animating so Android doesn't jump mid-flight.
    setActivePanel(route);
    setPanelRoute(route);
  };

  const openSortPanel = () => {
    Haptics.selectionChanged();
    setActivePanel('sort');
    setPanelRoute('sort');
  };

  const toggleFilter = (flag: FeedFilterFlag) => {
    Haptics.selectionChanged();
    setDraft((prev) => {
      if (hasFeedFilter(prev, flag)) {
        return {
          ...prev,
          filters: prev.filters.filter((item) => item !== flag),
        };
      }

      if (flag === 'location') {
        const cities =
          prev.locationCities.length === 0
            ? [...availableCities]
            : prev.locationCities;
        if (isAllSelection(cities, availableCities)) {
          setLocationSnapshot(cities);
          setPanelRoute('location');
          return { ...prev, locationCities: cities };
        }
        return {
          ...prev,
          locationCities: cities,
          filters: [...prev.filters, 'location'],
        };
      }

      if (flag === 'placeType') {
        const types =
          prev.primaryTypes.length === 0
            ? [...availablePrimaryTypes]
            : prev.primaryTypes;
        if (isAllSelection(types, availablePrimaryTypes)) {
          setPlaceTypeSnapshot(types);
          setPanelRoute('placeType');
          return { ...prev, primaryTypes: types };
        }
        return {
          ...prev,
          primaryTypes: types,
          filters: [...prev.filters, 'placeType'],
        };
      }

      return { ...prev, filters: [...prev.filters, flag] };
    });
  };

  const confirmLocationDraft = () => {
    setDraft((prev) => {
      const allSelected = isAllSelection(prev.locationCities, availableCities);
      const filters: FeedFilterFlag[] = allSelected
        ? prev.filters.filter((flag) => flag !== 'location')
        : prev.filters.includes('location')
          ? prev.filters
          : [...prev.filters, 'location'];
      return { ...prev, filters };
    });
    setLocationSnapshot(null);
    setPanelRoute(null);
  };

  const cancelLocationDraft = () => {
    if (locationSnapshot) {
      setDraft((prev) => {
        const cities = locationSnapshot;
        const allSelected = isAllSelection(cities, availableCities);
        return {
          ...prev,
          locationCities: cities,
          filters: allSelected
            ? prev.filters.filter((flag) => flag !== 'location')
            : prev.filters,
        };
      });
    }
    setLocationSnapshot(null);
    setPanelRoute(null);
  };

  const confirmPlaceTypeDraft = () => {
    setDraft((prev) => {
      const allSelected = isAllSelection(
        prev.primaryTypes,
        availablePrimaryTypes,
      );
      const filters: FeedFilterFlag[] = allSelected
        ? prev.filters.filter((flag) => flag !== 'placeType')
        : prev.filters.includes('placeType')
          ? prev.filters
          : [...prev.filters, 'placeType'];
      return { ...prev, filters };
    });
    setPlaceTypeSnapshot(null);
    setPanelRoute(null);
  };

  const cancelPlaceTypeDraft = () => {
    if (placeTypeSnapshot) {
      setDraft((prev) => {
        const types = placeTypeSnapshot;
        const allSelected = isAllSelection(types, availablePrimaryTypes);
        return {
          ...prev,
          primaryTypes: types,
          filters: allSelected
            ? prev.filters.filter((flag) => flag !== 'placeType')
            : prev.filters,
        };
      });
    }
    setPlaceTypeSnapshot(null);
    setPanelRoute(null);
  };

  const confirmSortDraft = (sortKind: FeedSortKind) => {
    setDraft((prev) => ({ ...prev, sortKind }));
    setPanelRoute(null);
  };

  const cancelPushedPanel = () => {
    if (panelRoute === 'location') {
      cancelLocationDraft();
      return;
    }
    if (panelRoute === 'placeType') {
      cancelPlaceTypeDraft();
      return;
    }
    setPanelRoute(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (panelRoute) {
          cancelPushedPanel();
          return;
        }
        onClose();
      }}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.stack} onLayout={onStackLayout}>
          <Animated.View
            style={[styles.page, styles.stackPage, rootPageStyle]}
            pointerEvents={panelRoute ? 'none' : 'auto'}>
            <View style={styles.nav}>
              <HouseToolbarIconButton
                iosName="xmark"
                androidName="close"
                accessibilityLabel="Reset filters"
                onPress={() => {
                  onReset();
                  onClose();
                }}
              />
              <SerifText size={20} weight="semibold" style={styles.navTitle}>
                Filter options
              </SerifText>
              <HouseToolbarIconButton
                iosName="checkmark"
                androidName="check"
                accessibilityLabel="Done"
                onPress={() => {
                  onApply(draft);
                  onClose();
                }}
              />
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.content,
                { paddingBottom: 28 + insets.bottom },
              ]}
              keyboardShouldPersistTaps="handled">
              <SerifText size={20} weight="semibold" style={styles.sectionTitle}>
                Filters
              </SerifText>

              <CheckboxRow
                title="None"
                selected={isNoneSelected}
                onPress={selectNone}
              />
              <CheckboxRow
                title="Favorites"
                selected={hasFeedFilter(draft, 'favorites')}
                onPress={() => toggleFilter('favorites')}
              />

              <CompositeFilterRow
                title="Location"
                summary={locationSummary}
                selected={hasFeedFilter(draft, 'location')}
                onToggle={() => toggleFilter('location')}
                onOpen={() => openMultiSelect('location')}
              />
              <CompositeFilterRow
                title="Cuisine type"
                summary={placeTypeSummary}
                selected={hasFeedFilter(draft, 'placeType')}
                onToggle={() => toggleFilter('placeType')}
                onOpen={() => openMultiSelect('placeType')}
              />

              <SerifText size={20} weight="semibold" style={styles.sectionTitle}>
                Sort by
              </SerifText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sort by"
                accessibilityValue={{ text: currentSortTitle }}
                onPress={openSortPanel}
                style={({ pressed }) => [
                  styles.sortRow,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.compositeText}>
                  <Text style={styles.rowTitle}>{currentSortTitle}</Text>
                  {draft.sortKind.type === 'averageScore' ? (
                    <Text style={styles.rowSubtitle}>Default</Text>
                  ) : null}
                </View>
                <SymbolView
                  name={{
                    ios: 'chevron.right',
                    android: 'chevron_right',
                    web: 'chevron_right',
                  }}
                  tintColor="rgba(35, 32, 26, 0.35)"
                  size={16}
                />
              </Pressable>

              <Text style={styles.count}>
                {matchingCount} of {totalCount} restaurants
              </Text>
            </ScrollView>
          </Animated.View>

          {activePanel === 'location' ? (
            <Animated.View
              style={[styles.page, styles.stackPage, pushedPageStyle]}
              pointerEvents={panelRoute === 'location' ? 'auto' : 'none'}>
              <MultiSelectFilterPanel
                title="Location"
                emptyTitle="No Locations Yet"
                emptyDescription="Add reviews with a city to filter by location."
                items={availableCities}
                selected={draft.locationCities}
                bottomInset={insets.bottom}
                onChangeSelected={(locationCities) =>
                  setDraft((prev) => ({ ...prev, locationCities }))
                }
                onConfirm={confirmLocationDraft}
                onCancel={cancelLocationDraft}
              />
            </Animated.View>
          ) : null}

          {activePanel === 'placeType' ? (
            <Animated.View
              style={[styles.page, styles.stackPage, pushedPageStyle]}
              pointerEvents={panelRoute === 'placeType' ? 'auto' : 'none'}>
              <MultiSelectFilterPanel
                title="Cuisine type"
                emptyTitle="No Cuisine Types Yet"
                emptyDescription="Add restaurants from the map or search to filter by cuisine type."
                emptySystemImage="fork.knife"
                emptyAndroidImage="restaurant"
                items={availablePrimaryTypes}
                selected={draft.primaryTypes}
                titleForItem={placeTypeDisplayName}
                bottomInset={insets.bottom}
                onChangeSelected={(primaryTypes) =>
                  setDraft((prev) => ({ ...prev, primaryTypes }))
                }
                onConfirm={confirmPlaceTypeDraft}
                onCancel={cancelPlaceTypeDraft}
              />
            </Animated.View>
          ) : null}

          {activePanel === 'sort' ? (
            <Animated.View
              style={[styles.page, styles.stackPage, pushedPageStyle]}
              pointerEvents={panelRoute === 'sort' ? 'auto' : 'none'}>
              <SortOptionsPanel
                draftSortKind={draft.sortKind}
                criteria={sortCriteria}
                bottomInset={insets.bottom}
                onSelect={confirmSortDraft}
                onCancel={() => setPanelRoute(null)}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function CheckboxIcon({ selected }: { selected: boolean }) {
  return (
    <SymbolView
      name={{
        ios: selected ? 'checkmark.square.fill' : 'square',
        android: selected ? 'check_box' : 'check_box_outline_blank',
        web: selected ? 'check_box' : 'check_box_outline_blank',
      }}
      tintColor={
        selected ? GustraColors.forestGreen : 'rgba(35, 32, 26, 0.35)'
      }
      size={24}
    />
  );
}

function CheckboxRow({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CheckboxIcon selected={selected} />
      <Text style={styles.rowTitle}>{title}</Text>
    </Pressable>
  );
}

function CompositeFilterRow({
  title,
  summary,
  selected,
  onToggle,
  onOpen,
}: {
  title: string;
  summary: string;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.compositeRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={styles.checkboxHit}>
        <CheckboxIcon selected={selected} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={`Choose ${title.toLowerCase()}`}
        accessibilityValue={{ text: summary }}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.compositeBody,
          pressed && styles.pressed,
        ]}>
        <View style={styles.compositeText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <SymbolView
          name={{
            ios: 'chevron.right',
            android: 'chevron_right',
            web: 'chevron_right',
          }}
          tintColor="rgba(35, 32, 26, 0.35)"
          size={16}
        />
      </Pressable>
    </View>
  );
}

export { DEFAULT_FEED_FILTER_STATE };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  stack: {
    flex: 1,
    overflow: 'hidden',
  },
  page: {
    flex: 1,
  },
  stackPage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: GustraColors.cream,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: GustraColors.forestGreen,
  },
  navTitle: {
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 12,
    gap: 8,
  },
  sectionTitle: {
    color: GustraColors.forestGreen,
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  compositeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    paddingRight: 14,
    paddingLeft: 14,
    gap: 4,
  },
  checkboxHit: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  compositeBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compositeText: {
    flex: 1,
    gap: 2,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
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
  count: {
    ...bodyTextStyle,
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.65)',
  },
  pressed: {
    opacity: 0.85,
  },
});
