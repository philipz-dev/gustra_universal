import { useRef, useState } from 'react';
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

type HeroPhotoPagerProps = {
  uris: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onPressPhoto: (index: number) => void;
};

/**
 * Horizontal review hero pager (Swift `ReviewDetailView.heroPhoto`).
 * Aspect-fit in a fixed 220pt canvas via `resizeMode="contain"` — no crop.
 * Avoid Image.getSize + nested frames (broke display on some devices).
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
  const canvasW = Math.max(1, width - HERO_H_PAD * 2);
  const canvasH = Math.max(1, HERO_H - 8);
  const [failed, setFailed] = useState(false);

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
        <View style={[styles.heroFrame, { width: canvasW, height: canvasH }]}>
          {failed ? (
            <View style={styles.failed} />
          ) : (
            <Image
              source={{ uri }}
              style={{ width: canvasW, height: canvasH }}
              resizeMode="contain"
              onError={() => setFailed(true)}
            />
          )}
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
  heroFrame: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(35, 32, 26, 0.14)',
    overflow: 'hidden',
    backgroundColor: GustraColors.bubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
  },
  pageIndicator: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(35, 32, 26, 0.55)',
    fontVariant: ['tabular-nums'],
  },
});
