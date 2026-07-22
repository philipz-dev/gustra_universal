import { useEffect } from 'react';
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
};

/**
 * Pinch / pan / double-tap photo canvas (Swift `ZoomablePhotoCanvas`).
 */
export function ZoomablePhoto({
  uri,
  isActive = true,
  accessibilityLabel = 'Photo',
  onZoomChange,
}: ZoomablePhotoProps) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const notifyZoom = (zoomed: boolean) => {
    onZoomChange?.(zoomed);
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
    savedX.value = 0;
    savedY.value = 0;
    if (onZoomChange) runOnJS(notifyZoom)(false);
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
  }, [isActive, onZoomChange, scale, savedScale, translateX, translateY, savedX, savedY]);

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
        if (onZoomChange) runOnJS(notifyZoom)(true);
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
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
    .onEnd(() => {
      if (scale.value > 1.01) {
        reset();
      } else {
        scale.value = withTiming(2, { duration: 180 });
        savedScale.value = 2;
        if (onZoomChange) runOnJS(notifyZoom)(true);
      }
    });

  const composed = Gesture.Simultaneous(
    pinch,
    Gesture.Simultaneous(pan, doubleTap),
  );

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
        accessibilityLabel={accessibilityLabel}>
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
  image: {
    // sized via window dimensions
  },
});
