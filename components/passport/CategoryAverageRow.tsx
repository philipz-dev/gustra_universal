import { Platform, StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle } from '@/constants/Theme';
import type { CategoryAveragesDisplayStyle } from '@/context/PassportDisplaySettings';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';

/** Android reads smaller at the same pt size; bump + tighter gap for passport. */
const STAR_SIZE = Platform.OS === 'android' ? 26 : 20;
const STAR_GAP = Platform.OS === 'android' ? -2 : 0;

type CategoryAverageRowProps = {
  title: string;
  average: number;
  style: CategoryAveragesDisplayStyle;
  /** 1-based rank prefix (City Averages). */
  rank?: number;
};

/** Matches Swift passport category row: numbers or fractional stars. */
export function CategoryAverageRow({
  title,
  average,
  style,
  rank,
}: CategoryAverageRowProps) {
  const label = typeof rank === 'number' ? `${rank}. ${title}` : title;
  return (
    <View
      style={styles.row}
      accessibilityLabel={`${label}, ${formatScoreOutOfFive(average)}`}>
      <Text style={styles.title} numberOfLines={2}>
        {label}
      </Text>
      {style === 'stars' ? (
        <FractionalStarRating
          score={average}
          size={STAR_SIZE}
          gap={STAR_GAP}
        />
      ) : (
        <SerifText size={17} weight="semibold" style={styles.value}>
          {formatScoreOutOfFive(average)}
        </SerifText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: 12,
  },
  title: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
  },

  value: {
    color: GustraColors.forestGreen,
  },
});
