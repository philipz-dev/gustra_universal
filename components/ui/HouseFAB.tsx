import { type PressableProps, StyleSheet, Pressable } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SPRING = { damping: 18, stiffness: 220 };

type HouseFABProps = PressableProps;

export function HouseFAB({ style, onPress, ...rest }: HouseFABProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Add review"
      onPressIn={() => {
        scale.value = withSpring(0.9, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      onPress={(e) => {
        Haptics.light();
        if (typeof onPress === 'function') onPress(e);
      }}
      style={(state) => [
        styles.fab,
        Theme.fabShadow,
        animatedStyle,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <SymbolView
        name={{ ios: 'plus', android: 'add', web: 'add' }}
        tintColor="#FFFFFF"
        size={28}
      />
    </AnimatedPressable>
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
});
