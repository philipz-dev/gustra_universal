import { StyleSheet, View } from 'react-native';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import type { SatisfactionLevel } from '@/data/types';

const COLORS: Record<SatisfactionLevel, string> = {
  excellent: GustraColors.ratingExcellent,
  neutral: GustraColors.ratingNeutral,
  avoid: GustraColors.ratingAvoid,
};

export function SatisfactionDot({ level }: { level: SatisfactionLevel }) {
  return <View style={[styles.dot, { backgroundColor: COLORS[level] }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: Theme.size.satisfactionDot,
    height: Theme.size.satisfactionDot,
    borderRadius: Theme.size.satisfactionDot / 2,
  },
});
