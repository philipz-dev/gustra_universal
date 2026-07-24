import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

const HERO_H = Theme.size.heroHeight;
const HERO_H_PAD = 16;
const HERO_V_PAD = 4;

type HeroPhotoPagerProps = {
  uris: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onPressPhoto: (index: number) => void;
};

/**
 * Horizontal review hero pager (Swift `ReviewDetailView.heroPhoto`).
 * Aspect-fit inside a fixed 220pt canvas — never crop/stretch (`cover`).
 */
export function HeroPhotoPager({
  uris,
  index,
  onIndexChange,
  onPressPhoto,
}: HeroPhotoPagerProps) {
  const pageWidth = useRef(Dimensions.get('window').width).current;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < uris.length) {
      onIndexChange(next);
    }
  };

  return (
    <View style={styles.heroBlock}>
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={styles.heroScroll}>
        {uris.map((uri, photoIndex) => (
          <HeroPage
            key={`${uri}-${photoIndex}`}
            uri={uri}
            width={pageWidth}
            label={`Photo ${photoIndex + 1} of ${uris.length}`}
            onPress={() => onPressPhoto(photoIndex)}
          />
        ))}
      </ScrollView>
      {uris.length > 1 ? (
        <Text style={styles.pageIndicator}>
          {index + 1} / {uris.length}
        </Text>
      ) : null}
    </View>
  );
}

/** Aspect-fit size that keeps the full photo visible (Swift `fittedSize`). */
function fittedSize(
  imageW: number,
  imageH: number,
  canvasW: number,
  canvasH: number,
): { width: number; height: number } {
  if (imageW <= 0 || imageH <= 0 || canvasW <= 0 || canvasH <= 0) {
    return { width: canvasW, height: canvasH };
  }
  const imageAspect = imageW / imageH;
  const canvasAspect = canvasW / canvasH;
  if (imageAspect > canvasAspect) {
    const width = canvasW;
    return { width, height: width / imageAspect };
  }
  const height = canvasH;
  return { width: height * imageAspect, height };
}

function HeroPage({
  uri,
  width,
  label,
  onPress,
}: {
  uri: string;
  width: number;
  label: string;
  onPress: () => void;
}) {
  const canvasW = Math.max(0, width - HERO_H_PAD * 2);
  const canvasH = Math.max(0, HERO_H - HERO_V_PAD);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNatural(null);
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled) setNatural({ w, h });
      },
      () => {
        if (!cancelled) setNatural({ w: canvasW, h: canvasH });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri, canvasW, canvasH]);

  const fitted = natural
    ? fittedSize(natural.w, natural.h, canvasW, canvasH)
    : { width: canvasW, height: canvasH };

  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd(() => {
      runOnJS(onPress)();
    });

  return (
    <GestureDetector gesture={tap}>
      <View
        style={[styles.heroPage, { width }]}
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        collapsable={false}>
        <View style={[styles.heroCanvas, { width: canvasW, height: canvasH }]}>
          <View
            style={[
              styles.heroFrame,
              { width: fitted.width, height: fitted.height },
            ]}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    paddingTop: 12,
    gap: 10,
    backgroundColor: GustraColors.cream,
  },
  heroScroll: {
    height: HERO_H,
  },
  heroPage: {
    height: HERO_H,
    paddingHorizontal: HERO_H_PAD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCanvas: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GustraColors.cream,
  },
  heroFrame: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(35, 32, 26, 0.14)',
    overflow: 'hidden',
    backgroundColor: GustraColors.bubble,
  },
  pageIndicator: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(35, 32, 26, 0.55)',
    fontVariant: ['tabular-nums'],
  },
});
