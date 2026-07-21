import { StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle } from '@/constants/Theme';
import type { CategoryAveragesDisplayStyle } from '@/context/PassportDisplaySettings';


type CategoryAverageRowProps = {
  title: string;
  average: number;
  style: CategoryAveragesDisplayStyle;
};

/** Matches Swift passport category row: numbers or fractional stars. */
export function CategoryAverageRow({
  title,
  average,
  style,
}: CategoryAverageRowProps) {
  return (
    <View
      style={styles.row}
      accessibilityLabel={`${title}, ${average.toFixed(1)} of 5`}>
      <Text style={styles.title}>{title}</Text>
      {style === 'stars' ? (
        <FractionalStarRating score={average} size={18} />
      ) : (
        <SerifText size={17} weight="semibold" style={styles.value}>
          {`${average.toFixed(1)}/5`}
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
