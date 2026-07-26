import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  PHOTO_PLACEHOLDER_BG,
  PhotoPlaceholder,
} from '@/components/ui/PhotoPlaceholder';
import { Theme } from '@/constants/Theme';

type RestaurantThumbProps = {
  uri?: string;
  size?: number;
};

/** 64×64 feed thumbnail — dish/interior photo with fork.knife fallback. */
export function RestaurantThumb({
  uri,
  size = Theme.size.thumbnail,
}: RestaurantThumbProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = uri?.trim() ?? '';

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  const showImage = trimmed.length > 0 && !failed;

  return (
    <View
      style={[
        styles.thumb,
        {
          width: size,
          height: size,
          borderRadius: Theme.radius.md,
          backgroundColor: showImage ? Theme.colors.bubble : PHOTO_PLACEHOLDER_BG,
        },
      ]}>
      {showImage ? (
        <Image
          key={trimmed}
          source={{ uri: trimmed }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <PhotoPlaceholder iconSize={size * 0.4} />
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
