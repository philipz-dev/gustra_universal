import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Haptics } from '@/services/haptics';

/** Same muted red as iOS SF Symbol heart fills tint. */
const HEART_RED = '#C74742';
const HEART_EMPTY = 'rgba(35, 32, 26, 0.35)';
const PRESS_SPRING = { damping: 16, stiffness: 280, mass: 0.6 };

/** SF Symbol–like heart in a 24×24 viewBox. */
const HEART_PATH =
  'M12 21s-6.7-4.35-9.33-8.1C.8 10.2.9 6.7 3.4 4.7 5.3 3.2 7.9 3.4 9.6 5.1L12 7.6l2.4-2.5c1.7-1.7 4.3-1.9 6.2-.4 2.5 2 2.6 5.5.73 8.2C18.7 16.65 12 21 12 21z';

type FavoriteHeartButtonProps = {
  /** Controlled favorite value (preferred). */
  favorite?: boolean;
  /** Uncontrolled initial value when `favorite` is omitted. */
  initialFavorite?: boolean;
  onToggle?: (favorite: boolean) => void;
};

function HeartIcon({ filled, size = 22 }: { filled: boolean; size?: number }) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={HEART_PATH} fill={HEART_RED} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={HEART_PATH}
        fill="none"
        stroke={HEART_EMPTY}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FavoriteHeartButton({
  favorite: favoriteProp,
  initialFavorite = false,
  onToggle,
}: FavoriteHeartButtonProps) {
  const isControlled = favoriteProp !== undefined;
  const [favorite, setFavorite] = useState(
    isControlled ? favoriteProp : initialFavorite,
  );
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    if (isControlled) setFavorite(favoriteProp);
  }, [favoriteProp, isControlled]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favorite ? 'Remove favorite' : 'Add favorite'}
      hitSlop={8}
      onPress={() => {
        const next = !favorite;
        Haptics.medium();
        // withSequence — nested withSpring completion callbacks recurse
        // into valueSetter and blow the native call stack (Reanimated 4).
        cancelAnimation(scale);
        scale.value = withSequence(
          withSpring(1.18, PRESS_SPRING),
          withSpring(1, PRESS_SPRING),
        );
        if (!isControlled) setFavorite(next);
        onToggle?.(next);
      }}
      style={styles.hit}>
      <Animated.View style={[styles.icon, animatedStyle]}>
        <HeartIcon filled={favorite} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: 2,
  },
  icon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
