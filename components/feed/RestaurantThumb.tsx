import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Theme } from '@/constants/Theme';

type RestaurantThumbProps = {
  uri?: string;
  size?: number;
};

/** Matches Swift feed placeholder: forestGreen @ 12% fill + forestGreen fork.knife. */
const PLACEHOLDER_BG = 'rgba(36, 78, 57, 0.12)';

/** 64×64 feed thumbnail — dish/interior photo with fork.knife fallback. */
export function RestaurantThumb({
  uri,
  size = Theme.size.thumbnail,
}: RestaurantThumbProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;

  return (
    <View
      style={[
        styles.thumb,
        {
          width: size,
          height: size,
          borderRadius: Theme.radius.md,
          backgroundColor: showImage ? Theme.colors.bubble : PLACEHOLDER_BG,
        },
      ]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <SymbolView
          // Material `local_dining` ≈ SF `fork.knife` (not the `restaurant` glyph).
          name={{ ios: 'fork.knife', android: 'local_dining', web: 'restaurant' }}
          tintColor={Theme.colors.forestGreen}
          size={size * 0.4}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
