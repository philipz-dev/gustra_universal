import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * No photos (or only broken URIs) → render nothing (no fork.knife placeholder).
 */
export function HeroPhotoPager({
  uris,
  index,
  onIndexChange,
  onPressPhoto,
}: HeroPhotoPagerProps) {
  const pageWidth = useRef(Dimensions.get('window').width).current;
  const trimmed = useMemo(
    () => uris.map((u) => u.trim()).filter(Boolean),
    [uris],
  );
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFailed((prev) => {
      const next = new Set<string>();
      for (const uri of prev) {
        if (trimmed.includes(uri)) next.add(uri);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [trimmed]);

  const pages = useMemo(
    () => trimmed.filter((uri) => !failed.has(uri)),
    [trimmed, failed],
  );

  const markFailed = useCallback((uri: string) => {
    setFailed((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < pages.length) {
      onIndexChange(next);
    }
  };

  if (pages.length === 0) {
    return null;
  }

  const safeIndex = Math.min(Math.max(index, 0), pages.length - 1);

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
        {pages.map((uri, photoIndex) => (
          <HeroPage
            key={`${uri}-${photoIndex}`}
            uri={uri}
            width={pageWidth}
            label={`Photo ${photoIndex + 1} of ${pages.length}`}
            onPress={() => onPressPhoto(photoIndex)}
            onError={() => markFailed(uri)}
          />
        ))}
      </ScrollView>
      {pages.length > 1 ? (
        <Text style={styles.pageIndicator}>
          {safeIndex + 1} / {pages.length}
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
  onError,
}: {
  uri: string;
  width: number;
  label: string;
  onPress: () => void;
  onError: () => void;
}) {
  const canvasW = Math.max(1, width - HERO_H_PAD * 2);
  const canvasH = Math.max(1, HERO_H - 8);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const handlePress = useCallback(() => {
    onPressRef.current();
  }, []);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(12)
        .onEnd(() => {
          'worklet';
          runOnJS(handlePress)();
        }),
    [handlePress],
  );

  return (
    <GestureDetector gesture={tap}>
      <View
        style={[styles.heroPage, { width }]}
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        collapsable={false}>
        <View style={[styles.heroFrame, { width: canvasW, height: canvasH }]}>
          <Image
            key={uri}
            source={{ uri }}
            style={{ width: canvasW, height: canvasH }}
            resizeMode="contain"
            onError={onError}
          />
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
  pageIndicator: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(35, 32, 26, 0.55)',
    fontVariant: ['tabular-nums'],
  },
});
