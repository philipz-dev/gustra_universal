import { StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { captionTextStyle } from '@/constants/Theme';

type PassportStatCardsProps = {
  totalReviews: number;
  averageOverall: string;
  totalLabel: string;
  averageLabel: string;
  /** Explains that the average is over all rated criteria, not a subset. */
  averageSubtitle?: string;
};

/**
 * "Overview" stat cards — replaces the two PassportStatRow rows. Big serif
 * number with a small caption underneath, side by side (wider card for the
 * total, golden accent ring). No longer an Excel-like two-row list.
 */
export function PassportStatCards({
  totalReviews,
  averageOverall,
  totalLabel,
  averageLabel,
  averageSubtitle,
}: PassportStatCardsProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.cardTotal]}>
        <SerifText size={40} weight="bold" style={styles.totalValue}>
          {totalReviews}
        </SerifText>
        <Text style={styles.caption}>{totalLabel}</Text>
      </View>
      <View style={[styles.card, styles.cardAverage]}>
        <SerifText size={40} weight="bold" style={styles.averageValue}>
          {averageOverall}
        </SerifText>
        <Text style={styles.caption}>{averageLabel}</Text>
        {averageSubtitle ? (
          <Text style={styles.subtitle}>{averageSubtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTotal: {
    flex: 1.25,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    borderColor: 'rgba(36, 78, 57, 0.22)',
  },
  cardAverage: {
    flex: 1,
    backgroundColor: 'rgba(217, 162, 39, 0.1)',
    borderColor: 'rgba(217, 162, 39, 0.4)',
  },
  totalValue: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
    lineHeight: 46,
  },
  averageValue: {
    color: GustraColors.gold,
    fontVariant: ['tabular-nums'],
    lineHeight: 46,
  },
  caption: {
    ...captionTextStyle,
    marginTop: 2,
    fontSize: 13,
    textAlign: 'center',
    color: 'rgba(35, 32, 26, 0.6)',
  },
  subtitle: {
    ...captionTextStyle,
    marginTop: 4,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    color: 'rgba(35, 32, 26, 0.45)',
  },
});
