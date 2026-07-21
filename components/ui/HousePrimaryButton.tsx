import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, View } from 'react-native';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

type HousePrimaryButtonProps = PressableProps & {
  title: string;
  flex?: boolean;
};

export function HousePrimaryButton({
  title,
  flex,
  style,
  disabled,
  ...rest
}: HousePrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.base,
        flex && styles.flex,
        (state.pressed || disabled) && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

export function HousePrimaryButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: GustraColors.forestGreen,
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
