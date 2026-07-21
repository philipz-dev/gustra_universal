import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Same muted red as iOS SF Symbol heart.fill tint. */
const HEART_RED = '#C74742';
const HEART_EMPTY = 'rgba(35, 32, 26, 0.35)';

/** SF Symbol–like heart in a 24×24 viewBox. */
const HEART_PATH =
  'M12 21s-6.7-4.35-9.33-8.1C.8 10.2.9 6.7 3.4 4.7 5.3 3.2 7.9 3.4 9.6 5.1L12 7.6l2.4-2.5c1.7-1.7 4.3-1.9 6.2-.4 2.5 2 2.6 5.5.73 8.2C18.7 16.65 12 21 12 21z';

type FavoriteHeartButtonProps = {
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
  initialFavorite = false,
  onToggle,
}: FavoriteHeartButtonProps) {
  const [favorite, setFavorite] = useState(initialFavorite);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favorite ? 'Remove favorite' : 'Add favorite'}
      hitSlop={8}
      onPress={() => {
        const next = !favorite;
        setFavorite(next);
        onToggle?.(next);
      }}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <HeartIcon filled={favorite} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
