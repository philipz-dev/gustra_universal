import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  hasFeedFilter,
  sortKindTitle,
  type FeedFilterState,
} from '@/components/feed/feedFilters';
import { placeTypeDisplayName } from '@/constants/PlaceTypeLabels';
import { GustraColors } from '@/constants/Colors';
import { captionTextStyle, Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

type ActiveFilterSummaryProps = {
  state: FeedFilterState;
  visibleResultCount: number;
  totalResultCount: number;
  criterionTitleFor?: (criterionId: string) => string;
  onChange: (next: FeedFilterState) => void;
};

/**
 * Active filter/sort chips under the search bar (Swift `FilterMatrixView` summary).
 */
export function ActiveFilterSummary({
  state,
  visibleResultCount,
  totalResultCount,
  criterionTitleFor,
  onChange,
}: ActiveFilterSummaryProps) {
  const { t } = useAppTranslation();
  const showSort = state.sortKind.type !== 'date';
  const showFavorites = hasFeedFilter(state, 'favorites');
  const showFriends = hasFeedFilter(state, 'friends');
  const showLocation = hasFeedFilter(state, 'location');
  const showPlaceType = hasFeedFilter(state, 'placeType');

  if (
    !showSort &&
    !showFavorites &&
    !showFriends &&
    !showLocation &&
    !showPlaceType
  ) {
    return null;
  }

  const locationTitle =
    state.locationCities.length === 0
      ? t('filters.chips.location')
      : [...state.locationCities]
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          .join(' · ');

  const placeTypeTitle =
    state.primaryTypes.length === 0
      ? t('filters.chips.cuisine')
      : [...state.primaryTypes]
          .sort((a, b) =>
            placeTypeDisplayName(a).localeCompare(
              placeTypeDisplayName(b),
              undefined,
              { sensitivity: 'base' },
            ),
          )
          .map(placeTypeDisplayName)
          .join(' · ');

  const clear = (next: FeedFilterState) => {
    Haptics.selectionChanged();
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chipsRow}>
        {showSort ? (
          <Chip
            title={sortKindTitle(state.sortKind, criterionTitleFor)}
            iosName="arrow.up.arrow.down"
            androidName="swap_vert"
            accessibilityHint={t('a11y.clearSort')}
            onPress={() =>
              clear({ ...state, sortKind: { type: 'date' } })
            }
          />
        ) : null}

        {showFavorites ? (
          <Chip
            title={t('filters.chips.favorites')}
            iosName="heart.fill"
            androidName="favorite"
            accessibilityHint={t('a11y.clearFavorites')}
            onPress={() =>
              clear({
                ...state,
                filters: state.filters.filter((flag) => flag !== 'favorites'),
              })
            }
          />
        ) : null}

        {showFriends ? (
          <Chip
            title={t('filters.chips.friends')}
            iosName="person.2.fill"
            androidName="group"
            accessibilityHint={t('a11y.clearFriends')}
            onPress={() =>
              clear({
                ...state,
                filters: state.filters.filter((flag) => flag !== 'friends'),
              })
            }
          />
        ) : null}

        {showLocation ? (
          <Chip
            title={locationTitle}
            iosName="mappin.and.ellipse"
            androidName="place"
            accessibilityHint={t('a11y.clearLocation')}
            onPress={() =>
              clear({
                ...state,
                filters: state.filters.filter((flag) => flag !== 'location'),
                locationCities: [],
              })
            }
          />
        ) : null}

        {showPlaceType ? (
          <Chip
            title={placeTypeTitle}
            iosName="fork.knife"
            androidName="restaurant"
            accessibilityHint={t('a11y.clearCuisine')}
            onPress={() =>
              clear({
                ...state,
                filters: state.filters.filter((flag) => flag !== 'placeType'),
                primaryTypes: [],
              })
            }
          />
        ) : null}
      </View>

      <Text
        style={styles.count}
        accessibilityLabel={t('filters.resultsCount', {
          shown: visibleResultCount,
          total: totalResultCount,
        })}>
        {visibleResultCount}/{totalResultCount}
      </Text>
    </View>
  );
}

function Chip({
  title,
  iosName,
  androidName,
  accessibilityHint,
  onPress,
}: {
  title: string;
  iosName: string;
  androidName: string;
  accessibilityHint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <SymbolView
        name={{
          ios: iosName as never,
          android: androidName as never,
          web: androidName as never,
        }}
        tintColor="#FFFFFF"
        size={14}
      />
      <Text style={styles.chipLabel} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.searchHorizontal,
    paddingBottom: Theme.spacing.searchVertical,
    gap: 8,
    backgroundColor: GustraColors.cream,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  count: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.55)',
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: GustraColors.forestGreen,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
