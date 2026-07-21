import { StyleSheet, View, type ViewProps } from 'react-native';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

/** Bubble card surface matching iOS feed cards (no hard border). */
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(236, 227, 207, 0.6)',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.cardPadding,
  },
});
