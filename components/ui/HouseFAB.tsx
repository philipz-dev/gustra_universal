import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

type HouseFABProps = PressableProps;

export function HouseFAB({ style, ...rest }: HouseFABProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add review"
      style={(state) => [
        styles.fab,
        Theme.fabShadow,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <SymbolView
        name={{ ios: 'plus', android: 'add', web: 'add' }}
        tintColor="#FFFFFF"
        size={28}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Theme.spacing.fabTrailing,
    bottom: Theme.spacing.fabBottom,
    width: Theme.size.fab,
    height: Theme.size.fab,
    borderRadius: Theme.size.fab / 2,
    backgroundColor: GustraColors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.92 }],
  },
});
