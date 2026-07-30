import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
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
   * Pager mode: omit double-tap; delay one-finger pan until zoomed so the
   * horizontal ScrollView keeps receiving page swipes (esp. Android).
   */
  pagingFriendly?: boolean;
};

/**
 * Pinch / pan / double-tap photo canvas (Swift `ZoomablePhotoCanvas`).
 * Gestures + runOnJS targets stay stable (avoids Reanimated DisplayLink abort).
 */
export function ZoomablePhoto({
  uri,
  isActive = true,
  accessibilityLabel = 'Photo',
  onZoomChange,
  pagingFriendly = false,
}: ZoomablePhotoProps) {
  const { width, height } = useWindowDimensions();
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const mountedRef = useRef(true);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const notifyZoom = useCallback((next: boolean) => {
    if (!mountedRef.current) return;
    onZoomChangeRef.current?.(next);
  }, []);

  const resetWorkletBridge = useCallback(() => {
    notifyZoom(false);
  }, [notifyZoom]);

  const markZoomed = useCallback(() => {
    notifyZoom(true);
  }, [notifyZoom]);

  useEffect(() => {
    if (!isActive) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
      notifyZoom(false);
    }
  }, [
    isActive,
    notifyZoom,
    scale,
    savedScale,
    translateX,
    translateY,
    savedX,
    savedY,
  ]);

  const composed = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        'worklet';
        const next = Math.min(4, Math.max(1, savedScale.value * e.scale));
        scale.value = next;
      })
      .onEnd(() => {
        'worklet';
        if (scale.value <= 1.01) {
          scale.value = withTiming(1, { duration: 180 });
          savedScale.value = 1;
          translateX.value = withTiming(0, { duration: 180 });
          translateY.value = withTiming(0, { duration: 180 });
          savedX.value = 0;
          savedY.value = 0;
          runOnJS(resetWorkletBridge)();
        } else {
          savedScale.value = scale.value;
          runOnJS(markZoomed)();
        }
      });

    // One-finger pan only when zoomed — attaching a failing Pan on Android
    // paging still steals the horizontal ScrollView touch arena.
    const pan = Gesture.Pan()
      .manualActivation(true)
      .onTouchesMove((_e, state) => {
        'worklet';
        if (savedScale.value > 1.01) {
          state.activate();
        } else {
          state.fail();
        }
      })
      .onUpdate((e) => {
        'worklet';
        if (savedScale.value <= 1.01) return;
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      })
      .onEnd(() => {
        'worklet';
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(250)
      .onEnd(() => {
        'worklet';
        if (scale.value > 1.01) {
          scale.value = withTiming(1, { duration: 180 });
          savedScale.value = 1;
          translateX.value = withTiming(0, { duration: 180 });
          translateY.value = withTiming(0, { duration: 180 });
          savedX.value = 0;
          savedY.value = 0;
          runOnJS(resetWorkletBridge)();
        } else {
          scale.value = withTiming(2, { duration: 180 });
          savedScale.value = 2;
          runOnJS(markZoomed)();
        }
      });

    // Pager: no double-tap (horizontal swipe wins). Full canvas: double-tap + pinch/pan.
    // Pan always attached but fails until zoomed — keeps the gesture tree stable.
    if (pagingFriendly) {
      return Gesture.Simultaneous(pinch, pan);
    }
    return Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [
    markZoomed,
    pagingFriendly,
    resetWorkletBridge,
    savedScale,
    savedX,
    savedY,
    scale,
    translateX,
    translateY,
  ]);

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
          style={[styles.image, animatedStyle]}
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
  image: {
    width: '100%',
    height: '100%',
  },
});
