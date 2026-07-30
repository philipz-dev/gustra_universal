import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';

type HouseToolbarIconButtonProps = {
  /** SF Symbol name (iOS). Ignored when `ionName` is set. */
  iosName?: SFSymbol;
  /** Material Icons glyph (Android / web). Ignored when `ionName` is set. */
  androidName?: keyof typeof MaterialIcons.glyphMap;
  /**
   * Same Ionicons glyph on iOS + Android (e.g. funnel).
   * Prefer this when SF Symbol / Material shapes diverge.
   */
  ionName?: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress: () => void;
  /** Orange when filters/sort are active. */
  emphasized?: boolean;
  disabled?: boolean;
};

/**
 * Plain monochrome icon for the forest-green navigation bar.
 * Matches Swift: `.font(.body.weight(.semibold))` in a 44×44 hit target.
 */
export function HouseToolbarIconButton({
  iosName,
  androidName,
  ionName,
  accessibilityLabel,
  onPress,
  emphasized = false,
  disabled = false,
}: HouseToolbarIconButtonProps) {
  const color = disabled
    ? 'rgba(255, 255, 255, 0.35)'
    : emphasized
      ? GustraColors.ratingNeutral
      : '#FFFFFF';

  // Slightly larger than Swift `.body` so toolbar glyphs read clearly on both platforms.
  const iconSize = Platform.OS === 'ios' ? 26 : 28;

  let icon = null;
  if (ionName) {
    icon = <Ionicons name={ionName} size={iconSize} color={color} />;
  } else if (Platform.OS === 'ios' && iosName) {
    icon = (
      <SymbolView
        name={iosName}
        tintColor={color}
        size={iconSize}
        weight="semibold"
      />
    );
  } else if (androidName) {
    icon = <MaterialIcons name={androidName} size={iconSize} color={color} />;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      // Default Android ripple flashes on the green nav bar (reads as a spring).
      android_ripple={null}
      style={({ pressed }) => [
        styles.hit,
        (pressed || disabled) && styles.pressed,
      ]}>
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
