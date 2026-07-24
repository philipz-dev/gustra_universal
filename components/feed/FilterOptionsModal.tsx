import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import {
  DEFAULT_FEED_FILTER_STATE,
  availableCitiesFromSummaries,
  availablePrimaryTypesFromSummaries,
  feedFilterPreviewCount,
  hasFeedFilter,
  isAllSelection,
  mergeSummariesByRestaurant,
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
import { useAppTranslation } from '@/hooks/useAppTranslation';
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
  /** My map: same filters, no Sort by (order is meaningless on the map). */
  hideSort?: boolean;
  /** Show “Include friend's reviews”; pair with friendSummaries. */
  showFriendsFilter?: boolean;
  friendSummaries?: RestaurantVisitSummary[];
  onApply: (next: FeedFilterState) => void;
  onReset: () => void;
  onClose: () => void;
};

/** UINavigationController-like ease (no spring / bounce). */
const NAV_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const NAV_DURATION_MS = 280;

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
  hideSort = false,
  showFriendsFilter = false,
  friendSummaries = [],
  onApply,
  onReset,
  onClose,
}: FilterOptionsModalProps) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FeedFilterState>(value);
  const [panelRoute, setPanelRoute] = useState<PanelRoute | null>(null);
  /** Content kept mounted through the pop animation (avoids remount jump). */
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
  /** Keep route in a ref so pop-animation callbacks can ignore a re-push. */
  const panelRouteRef = useRef(panelRoute);
  panelRouteRef.current = panelRoute;

  const onStackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    // Never resize mid-push — that causes a layout jump.
    if (width > 0 && !panelRoute && !activePanel) {
      sheetWidth.value = width;
    }
  };

  const finishPopAnimation = useCallback(() => {
    // Second push can start before the pop callback runs — never unmount then.
    if (panelRouteRef.current !== null) return;
    setActivePanel(null);
  }, []);

  const pushPanel = useCallback(
    (route: PanelRoute) => {
      // Mount + route together — panelRoute alone freezes (root pointerEvents
      // none while no pushed page is rendered).
      cancelAnimation(pushProgress);
      setActivePanel(route);
      setPanelRoute(route);
    },
    [pushProgress],
  );

  useEffect(() => {
    if (!visible) return;
    cancelAnimation(pushProgress);
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
      cancelAnimation(pushProgress);
      pushProgress.value = withTiming(1, {
        duration: NAV_DURATION_MS,
        easing: NAV_EASING,
      });
      return;
    }
    if (!activePanel) return;
    cancelAnimation(pushProgress);
    pushProgress.value = withTiming(
      0,
      { duration: NAV_DURATION_MS, easing: NAV_EASING },
      (finished) => {
        // Only clear when the pop actually completed. A cancelled pop (re-push
        // mid-animation) used to call clearActivePanel and freeze the second open.
        if (finished) {
          runOnJS(finishPopAnimation)();
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
  const previewSummaries = useMemo(() => {
    if (
      showFriendsFilter &&
      hasFeedFilter(draft, 'friends') &&
      friendSummaries.length > 0
    ) {
      return mergeSummariesByRestaurant([sourceSummaries, friendSummaries]);
    }
    return sourceSummaries;
  }, [draft, friendSummaries, showFriendsFilter, sourceSummaries]);

  const citiesForPanels = useMemo(
    () =>
      showFriendsFilter
        ? availableCitiesFromSummaries(previewSummaries)
        : availableCities,
    [availableCities, previewSummaries, showFriendsFilter],
  );
  const typesForPanels = useMemo(
    () =>
      showFriendsFilter
        ? availablePrimaryTypesFromSummaries(previewSummaries)
        : availablePrimaryTypes,
    [availablePrimaryTypes, previewSummaries, showFriendsFilter],
  );

  const locationSummary = selectionSummary(
    draft.locationCities,
    citiesForPanels,
  );
  const placeTypeSummary = placeTypeSelectionSummary(
    draft.primaryTypes,
    typesForPanels,
  );
  const currentSortTitle = sortKindTitle(
    draft.sortKind,
    filterOptions?.criterionTitleFor,
  );

  const matchingCount = useMemo(
    () => feedFilterPreviewCount(previewSummaries, draft, filterOptions),
    [draft, filterOptions, previewSummaries],
  );
  const totalCount = previewSummaries.length;

  const selectNone = () => {
    Haptics.selectionChanged();
    setDraft((prev) => ({ ...prev, filters: [] }));
  };

  const openMultiSelect = (route: 'location' | 'placeType') => {
    Haptics.selectionChanged();
    if (route === 'location') {
      const cities =
        draft.locationCities.length === 0
          ? [...citiesForPanels]
          : [...draft.locationCities];
      setLocationSnapshot(cities);
      setDraft((prev) => ({ ...prev, locationCities: cities }));
    } else {
      const types =
        draft.primaryTypes.length === 0
          ? [...typesForPanels]
          : [...draft.primaryTypes];
      setPlaceTypeSnapshot(types);
      setDraft((prev) => ({ ...prev, primaryTypes: types }));
    }
    pushPanel(route);
  };

  const openSortPanel = () => {
    Haptics.selectionChanged();
    pushPanel('sort');
  };

  const toggleFilter = (flag: FeedFilterFlag) => {
    Haptics.selectionChanged();

    if (hasFeedFilter(draft, flag)) {
      setDraft((prev) => ({
        ...prev,
        filters: prev.filters.filter((item) => item !== flag),
      }));
      return;
    }

    if (flag === 'location') {
      const cities =
        draft.locationCities.length === 0
          ? [...citiesForPanels]
          : [...draft.locationCities];
      if (isAllSelection(cities, citiesForPanels)) {
        // First enable → pick cities (Swift opens the location sheet).
        setLocationSnapshot(cities);
        setDraft((prev) => ({ ...prev, locationCities: cities }));
        pushPanel('location');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        locationCities: cities,
        filters: prev.filters.includes('location')
          ? prev.filters
          : [...prev.filters, 'location'],
      }));
      return;
    }

    if (flag === 'placeType') {
      const types =
        draft.primaryTypes.length === 0
          ? [...typesForPanels]
          : [...draft.primaryTypes];
      if (isAllSelection(types, typesForPanels)) {
        setPlaceTypeSnapshot(types);
        setDraft((prev) => ({ ...prev, primaryTypes: types }));
        pushPanel('placeType');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        primaryTypes: types,
        filters: prev.filters.includes('placeType')
          ? prev.filters
          : [...prev.filters, 'placeType'],
      }));
      return;
    }

    setDraft((prev) => ({
      ...prev,
      filters: [...prev.filters, flag],
    }));
  };

  const confirmLocationDraft = () => {
    setDraft((prev) => {
      const allSelected = isAllSelection(prev.locationCities, citiesForPanels);
      const filters: FeedFilterFlag[] = allSelected
        ? prev.filters.filter((item) => item !== 'location')
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
      const cities = locationSnapshot;
      const allSelected = isAllSelection(cities, citiesForPanels);
      setDraft((prev) => ({
        ...prev,
        locationCities: cities,
        filters: allSelected
          ? prev.filters.filter((item) => item !== 'location')
          : prev.filters,
      }));
    }
    setLocationSnapshot(null);
    setPanelRoute(null);
  };

  const confirmPlaceTypeDraft = () => {
    setDraft((prev) => {
      const allSelected = isAllSelection(prev.primaryTypes, typesForPanels);
      const filters: FeedFilterFlag[] = allSelected
        ? prev.filters.filter((item) => item !== 'placeType')
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
      const types = placeTypeSnapshot;
      const allSelected = isAllSelection(types, typesForPanels);
      setDraft((prev) => ({
        ...prev,
        primaryTypes: types,
        filters: allSelected
          ? prev.filters.filter((item) => item !== 'placeType')
          : prev.filters,
      }));
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
                accessibilityLabel={t('filters.reset')}
                onPress={() => {
                  onReset();
                  onClose();
                }}
              />
              <SerifText size={20} weight="semibold" style={styles.navTitle}>
                {t('filters.title')}
              </SerifText>
              <HouseToolbarIconButton
                iosName="checkmark"
                androidName="check"
                accessibilityLabel={t('filters.done')}
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
                {t('filters.filters')}
              </SerifText>

              <CheckboxRow
                title={t('filters.none')}
                selected={isNoneSelected}
                onPress={selectNone}
              />
              <CheckboxRow
                title={t('filters.favorites')}
                selected={hasFeedFilter(draft, 'favorites')}
                onPress={() => toggleFilter('favorites')}
              />
              {showFriendsFilter ? (
                <CheckboxRow
                  title={t('filters.friendsReviews')}
                  selected={hasFeedFilter(draft, 'friends')}
                  onPress={() => toggleFilter('friends')}
                />
              ) : null}

              <CompositeFilterRow
                title={t('filters.location')}
                summary={locationSummary}
                selected={hasFeedFilter(draft, 'location')}
                chooseHint={t('filters.choose', { title: t('filters.location') })}
                onToggle={() => toggleFilter('location')}
                onOpen={() => openMultiSelect('location')}
              />
              <CompositeFilterRow
                title={t('filters.cuisine')}
                summary={placeTypeSummary}
                selected={hasFeedFilter(draft, 'placeType')}
                chooseHint={t('filters.choose', { title: t('filters.cuisine') })}
                onToggle={() => toggleFilter('placeType')}
                onOpen={() => openMultiSelect('placeType')}
              />

              {!hideSort ? (
                <>
                  <SerifText
                    size={20}
                    weight="semibold"
                    style={styles.sectionTitle}>
                    {t('filters.sortBy')}
                  </SerifText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('filters.sortBy')}
                    accessibilityValue={{ text: currentSortTitle }}
                    onPress={openSortPanel}
                    style={({ pressed }) => [
                      styles.sortRow,
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.compositeText}>
                      <Text style={styles.rowTitle}>{currentSortTitle}</Text>
                      {draft.sortKind.type === 'averageScore' ? (
                        <Text style={styles.rowSubtitle}>{t('filters.default')}</Text>
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
                </>
              ) : null}

              <Text style={styles.count}>
                {t('filters.restaurantCount', {
                  shown: matchingCount,
                  total: totalCount,
                })}
              </Text>
            </ScrollView>
          </Animated.View>

          {activePanel === 'location' ? (
            <Animated.View
              style={[styles.page, styles.stackPage, pushedPageStyle]}
              pointerEvents={panelRoute === 'location' ? 'auto' : 'none'}>
              <MultiSelectFilterPanel
                title={t('filters.location')}
                emptyTitle={t('filters.emptyLocationTitle')}
                emptyDescription={t('filters.emptyLocationBody')}
                items={citiesForPanels}
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
                title={t('filters.cuisine')}
                emptyTitle={t('filters.emptyCuisineTitle')}
                emptyDescription={t('filters.emptyCuisineBody')}
                emptySystemImage="fork.knife"
                emptyAndroidImage="restaurant"
                items={typesForPanels}
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

          {activePanel === 'sort' && !hideSort ? (
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
  chooseHint,
  onToggle,
  onOpen,
}: {
  title: string;
  summary: string;
  selected: boolean;
  chooseHint: string;
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
        accessibilityHint={chooseHint}
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
