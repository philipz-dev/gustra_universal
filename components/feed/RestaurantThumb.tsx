import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PHOTO_PLACEHOLDER_BG } from '@/components/ui/PhotoPlaceholder';
import { Theme } from '@/constants/Theme';
import { relocateLocalPhotoRef } from '@/services/backup/photos';

type RestaurantThumbProps = {
  uri?: string;
  size?: number;
};

/** Icon fills most of the thumb — avoid a tiny glyph floating in an inner frame. */
const PLACEHOLDER_ICON_RATIO = 0.58;

/** 64×64 feed thumbnail — dish/interior photo with fork.knife fallback. */
export function RestaurantThumb({
  uri,
  size = Theme.size.thumbnail,
}: RestaurantThumbProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = uri?.trim() ?? '';
  const displayUri = trimmed ? relocateLocalPhotoRef(trimmed) : '';

  useEffect(() => {
    setFailed(false);
  }, [displayUri]);

  const showImage = displayUri.length > 0 && !failed;

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
          key={displayUri}
          source={{ uri: displayUri }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <SymbolView
          // Material `local_dining` ≈ SF `fork.knife` (not the `restaurant` glyph).
          name={{ ios: 'fork.knife', android: 'local_dining', web: 'restaurant' }}
          tintColor={Theme.colors.forestGreen}
          size={size * PLACEHOLDER_ICON_RATIO}
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
