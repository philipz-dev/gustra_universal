import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { captionTextStyle } from '@/constants/Theme';
import type { CategoryAveragesDisplayStyle } from '@/context/PassportDisplaySettings';
import type { CityAverage } from '@/data/passportStats';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';

type CityChipsProps = {
  cities: CityAverage[];
  emptyLabel: string;
  style: CategoryAveragesDisplayStyle;
};

/**
 * Top cities as a horizontal swipeable chip row — "passport stamp" feel,
 * no more vertical ranked list. Each pill: map pin icon, city name and score
 * (stars or number, per the shared passport display setting).
 */
export function CityChips({ cities, emptyLabel, style }: CityChipsProps) {
  if (cities.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      {cities.map((row) => (
        <View key={row.city} style={styles.chip}>
          <View style={styles.chipIcon}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="mappin.and.ellipse"
                tintColor={GustraColors.forestGreen}
                size={18}
              />
            ) : (
              <MaterialIcons
                name="place"
                size={20}
                color={GustraColors.forestGreen}
              />
            )}
          </View>
          <View style={styles.chipCopy}>
            <Text style={styles.cityName} numberOfLines={1}>
              {row.city}
            </Text>
            {style === 'stars' ? (
              <FractionalStarRating score={row.average} size={13} gap={1} />
            ) : (
              <SerifText size={14} weight="bold" style={styles.score}>
                {formatScoreOutOfFive(row.average)}
              </SerifText>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.6)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(36, 78, 57, 0.16)',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(36, 78, 57, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCopy: {
    gap: 1,
    alignItems: 'flex-start',
  },
  cityName: {
    ...captionTextStyle,
    fontSize: 15,
    fontWeight: '600',
    color: GustraColors.ink,
    maxWidth: 120,
  },
  score: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptyText: {
    ...captionTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.55)',
  },
});
