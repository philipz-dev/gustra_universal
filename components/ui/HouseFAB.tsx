import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

type HouseFABProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

/**
 * Floating add-review button. Plain Pressable (no Reanimated) — animated
 * `style` callbacks were dropping absolute layout on some devices.
 */
export function HouseFAB({ style, onPress, ...rest }: HouseFABProps) {
  const { t } = useAppTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('a11y.addReview')}
      hitSlop={8}
      onPress={(e) => {
        Haptics.light();
        if (typeof onPress === 'function') onPress(e);
      }}
      style={({ pressed }) => [
        styles.fab,
        Theme.fabShadow,
        style,
        pressed && styles.pressed,
      ]}
      {...rest}>
      {Platform.OS === 'ios' ? (
        <SymbolView name="plus" tintColor="#FFFFFF" size={28} />
      ) : (
        <MaterialIcons name="add" size={30} color="#FFFFFF" />
      )}
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
    zIndex: 100,
    elevation: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
});
