import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';

type HouseToolbarIconButtonProps = {
  /** SF Symbol name (iOS). */
  iosName: SFSymbol;
  /** Material Icons glyph (Android / web). */
  androidName: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  /** Gold when filters/sort are active (Swift `isEmphasized`). */
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
  accessibilityLabel,
  onPress,
  emphasized = false,
  disabled = false,
}: HouseToolbarIconButtonProps) {
  const color = disabled
    ? 'rgba(255, 255, 255, 0.35)'
    : emphasized
      ? GustraColors.gold
      : '#FFFFFF';

  // Slightly larger than Swift `.body` so toolbar glyphs read clearly on both platforms.
  const iconSize = Platform.OS === 'ios' ? 26 : 28;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hit,
        (pressed || disabled) && styles.pressed,
      ]}>
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={iosName}
          tintColor={color}
          size={iconSize}
          weight="semibold"
        />
      ) : (
        <MaterialIcons name={androidName} size={iconSize} color={color} />
      )}
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
