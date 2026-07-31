import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
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

/** Max pan so a scale-around-center image still covers the canvas. */
function maxPanOffset(size: number, scale: number): number {
  'worklet';
  return Math.max(0, (size * (scale - 1)) / 2);
}

function clampPan(
  x: number,
  y: number,
  scale: number,
  width: number,
  height: number,
): { x: number; y: number } {
  'worklet';
  const maxX = maxPanOffset(width, scale);
  const maxY = maxPanOffset(height, scale);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

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

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => {
        if (mountedRef.current) {
          setImageSize({ width: w, height: h });
        }
      },
      () => {
        if (mountedRef.current) {
          setImageSize(null);
        }
      }
    );
  }, [uri]);

  const displayedSize = useMemo(() => {
    if (!imageSize) return { w: width, h: height };
    const containerAspect = width / height;
    const imageAspect = imageSize.width / imageSize.height;

    let w = width;
    let h = height;

    if (imageAspect > containerAspect) {
      w = width;
      h = width / imageAspect;
    } else {
      h = height;
      w = height * imageAspect;
    }

    return { w, h };
  }, [imageSize, width, height]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const canvasW = useSharedValue(width);
  const canvasH = useSharedValue(height);

  useEffect(() => {
    canvasW.value = displayedSize.w;
    canvasH.value = displayedSize.h;
  }, [displayedSize, canvasW, canvasH]);

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
        // Shrinking zoom can leave translation past the new bounds.
        const clamped = clampPan(
          translateX.value,
          translateY.value,
          next,
          canvasW.value,
          canvasH.value,
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
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
          const clamped = clampPan(
            translateX.value,
            translateY.value,
            scale.value,
            canvasW.value,
            canvasH.value,
          );
          translateX.value = withTiming(clamped.x, { duration: 180 });
          translateY.value = withTiming(clamped.y, { duration: 180 });
          savedX.value = clamped.x;
          savedY.value = clamped.y;
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
        const clamped = clampPan(
          savedX.value + e.translationX,
          savedY.value + e.translationY,
          scale.value,
          canvasW.value,
          canvasH.value,
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        const clamped = clampPan(
          translateX.value,
          translateY.value,
          scale.value,
          canvasW.value,
          canvasH.value,
        );
        translateX.value = withTiming(clamped.x, { duration: 180 });
        translateY.value = withTiming(clamped.y, { duration: 180 });
        savedX.value = clamped.x;
        savedY.value = clamped.y;
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
          // Zoomed-in center — stay at origin (already within bounds).
          translateX.value = 0;
          translateY.value = 0;
          savedX.value = 0;
          savedY.value = 0;
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
    canvasH,
    canvasW,
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
