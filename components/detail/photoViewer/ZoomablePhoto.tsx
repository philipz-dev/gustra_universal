import { useEffect } from 'react';
import { Image, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type ZoomablePhotoProps = {
  uri: string;
  /** When false, zoom resets (e.g. page became inactive). */
  isActive?: boolean;
  accessibilityLabel?: string;
  onZoomChange?: (zoomed: boolean) => void;
  /**
   * Pager mode: on Android render a plain image (no GestureDetector) so the
   * horizontal ScrollView always receives one-finger swipes.
   */
  pagingFriendly?: boolean;
};

/**
 * Pinch / pan / double-tap photo canvas (Swift `ZoomablePhotoCanvas`).
 */
export function ZoomablePhoto({
  uri,
  isActive = true,
  accessibilityLabel = 'Photo',
  onZoomChange,
  pagingFriendly = false,
}: ZoomablePhotoProps) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const notifyZoom = (next: boolean) => {
    onZoomChange?.(next);
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
    savedX.value = 0;
    savedY.value = 0;
    runOnJS(notifyZoom)(false);
  };

  useEffect(() => {
    if (!isActive) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
      onZoomChange?.(false);
    }
  }, [
    isActive,
    onZoomChange,
    scale,
    savedScale,
    translateX,
    translateY,
    savedX,
    savedY,
  ]);

  // Android pager: never mount a GestureDetector over the page — it wins the
  // touch arena and kills horizontal swipes even when Pan "fails".
  if (pagingFriendly && Platform.OS === 'android') {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={accessibilityLabel}
        style={[styles.image, { width, height }]}
        resizeMode="contain"
      />
    );
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(4, Math.max(1, savedScale.value * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        reset();
      } else {
        savedScale.value = scale.value;
        runOnJS(notifyZoom)(true);
      }
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (savedScale.value > 1.01) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate((e) => {
      if (savedScale.value <= 1.01) return;
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1.01) {
        reset();
      } else {
        scale.value = withTiming(2, { duration: 180 });
        savedScale.value = 2;
        runOnJS(notifyZoom)(true);
      }
    });

  const composed = pagingFriendly
    ? Gesture.Simultaneous(pinch, pan)
    : Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[styles.canvas, { width, height }]}
        accessibilityLabel={accessibilityLabel}
        collapsable={false}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, { width, height }, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {},
});
