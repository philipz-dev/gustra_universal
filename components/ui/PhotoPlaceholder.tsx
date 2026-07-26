import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Theme } from '@/constants/Theme';

/** Matches Swift feed placeholder: forestGreen @ 12% fill + forestGreen fork.knife. */
export const PHOTO_PLACEHOLDER_BG = 'rgba(36, 78, 57, 0.12)';

type PhotoPlaceholderProps = {
  /** Icon size in points (defaults to ~40% of a 64pt thumb). */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shared empty-photo glyph used on Reviews feed and review detail. */
export function PhotoPlaceholder({
  iconSize = Theme.size.thumbnail * 0.4,
  style,
}: PhotoPlaceholderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <SymbolView
        // Material `local_dining` ≈ SF `fork.knife` (not the `restaurant` glyph).
        name={{ ios: 'fork.knife', android: 'local_dining', web: 'restaurant' }}
        tintColor={Theme.colors.forestGreen}
        size={iconSize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PHOTO_PLACEHOLDER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
