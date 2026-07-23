import { useEffect, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { GustraColors } from '@/constants/Colors';
import {
  clampOffset,
  coverSize,
  type CropTransform,
  type ImageSize,
} from '@/services/photos/circularCrop';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

type CircularCropCanvasProps = {
  uri: string;
  accessibilityLabel?: string;
  onTransformChange?: (transform: CropTransform, diameter: number) => void;
  onImageSize?: (size: ImageSize) => void;
};

/**
 * Circular pinch / pan / zoom crop viewport
 * — Swift `ReviewerPhotoEditorView.cropCanvas`.
 */
export function CircularCropCanvas({
  uri,
  accessibilityLabel = 'Profile photo',
  onTransformChange,
  onImageSize,
}: CircularCropCanvasProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [diameter, setDiameter] = useState(windowWidth * 0.78);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  const onImageSizeRef = useRef(onImageSize);
  onTransformChangeRef.current = onTransformChange;
  onImageSizeRef.current = onImageSize;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const coverW = useSharedValue(diameter);
  const coverH = useSharedValue(diameter);
  const diameterSV = useSharedValue(diameter);

  const publish = (nextScale: number, x: number, y: number, dia: number) => {
    onTransformChangeRef.current?.(
      { scale: nextScale, offsetX: x, offsetY: y },
      dia,
    );
  };

  const resetTransform = (size: ImageSize, dia: number) => {
    const cover = coverSize(size, dia);
    coverW.value = cover.width;
    coverH.value = cover.height;
    diameterSV.value = dia;
    scale.value = 1;
    savedScale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    publish(1, 0, 0, dia);
  };

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled) return;
        const size = { width, height };
        setImageSize(size);
        onImageSizeRef.current?.(size);
        resetTransform(size, diameterSV.value);
      },
      () => {
        if (cancelled) return;
        const fallback = { width: 1, height: 1 };
        setImageSize(fallback);
        onImageSizeRef.current?.(fallback);
      },
    );
    return () => {
      cancelled = true;
    };
    // Intentionally reset only when the picked URI changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const next = Math.min(width, height) * 0.78;
    if (next <= 1) return;
    setDiameter(next);
    diameterSV.value = next;
    if (!imageSize) return;
    const cover = coverSize(imageSize, next);
    coverW.value = cover.width;
    coverH.value = cover.height;
    const clamped = clampOffset(
      offsetX.value,
      offsetY.value,
      imageSize,
      next,
      scale.value,
    );
    offsetX.value = clamped.x;
    offsetY.value = clamped.y;
    savedX.value = clamped.x;
    savedY.value = clamped.y;
    publish(scale.value, clamped.x, clamped.y, next);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * e.scale),
      );
      scale.value = next;
      const displayW = coverW.value * next;
      const displayH = coverH.value * next;
      const limX = Math.max(0, (displayW - diameterSV.value) / 2);
      const limY = Math.max(0, (displayH - diameterSV.value) / 2);
      offsetX.value = Math.min(Math.max(offsetX.value, -limX), limX);
      offsetY.value = Math.min(Math.max(offsetY.value, -limY), limY);
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
      runOnJS(publish)(
        scale.value,
        offsetX.value,
        offsetY.value,
        diameterSV.value,
      );
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      'worklet';
      const displayW = coverW.value * scale.value;
      const displayH = coverH.value * scale.value;
      const limX = Math.max(0, (displayW - diameterSV.value) / 2);
      const limY = Math.max(0, (displayH - diameterSV.value) / 2);
      offsetX.value = Math.min(
        Math.max(savedX.value + e.translationX, -limX),
        limX,
      );
      offsetY.value = Math.min(
        Math.max(savedY.value + e.translationY, -limY),
        limY,
      );
    })
    .onEnd(() => {
      'worklet';
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
      runOnJS(publish)(
        scale.value,
        offsetX.value,
        offsetY.value,
        diameterSV.value,
      );
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    width: coverW.value,
    height: coverH.value,
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      style={[styles.wrap, { height: windowWidth * 0.9 }]}
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.circle,
            {
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
            },
          ]}
          collapsable={false}>
          {imageSize ? (
            <Animated.Image
              source={{ uri }}
              style={[styles.image, imageStyle]}
              resizeMode="stretch"
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                width: diameter,
                height: diameter,
                borderRadius: diameter / 2,
              },
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GustraColors.forestGreen,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  image: {
    position: 'absolute',
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: 3,
    borderColor: GustraColors.forestGreen,
  },
});
