import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Theme } from '@/constants/Theme';

type RestaurantThumbProps = {
  uri?: string;
  fallbackColor?: string;
  size?: number;
};

/** 64×64 feed thumbnail — dish/interior photo with fork.knife fallback. */
export function RestaurantThumb({
  uri,
  fallbackColor = 'rgba(36, 78, 57, 0.12)',
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
          backgroundColor: fallbackColor,
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
          name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }}
          tintColor="rgba(36, 78, 57, 0.55)"
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
