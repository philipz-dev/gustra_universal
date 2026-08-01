import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  clampLabelOffset,
  labelCoverSize,
  type CropTransform,
  type ImageSize,
  type LabelCropViewport,
} from '@/services/photos/labelCrop';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
/** Portrait label frame (~wine bottle label). */
const LABEL_ASPECT = 0.68; // width / height

type LabelCropCanvasProps = {
  uri: string;
  accessibilityLabel?: string;
  onTransformChange?: (
    transform: CropTransform,
    viewport: LabelCropViewport,
  ) => void;
  onImageSize?: (size: ImageSize) => void;
};

/**
 * Rectangular pinch/pan crop for wine bottle labels.
 * Gestures + runOnJS targets stay stable (avoids Reanimated DisplayLink abort).
 */
export function LabelCropCanvas({
  uri,
  accessibilityLabel = 'Wine label',
  onTransformChange,
  onImageSize,
}: LabelCropCanvasProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [viewport, setViewport] = useState<LabelCropViewport>({
    width: windowWidth * 0.72,
    height: (windowWidth * 0.72) / LABEL_ASPECT,
  });
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  const onImageSizeRef = useRef(onImageSize);
  const imageSizeRef = useRef<ImageSize | null>(null);
  const mountedRef = useRef(true);
  onTransformChangeRef.current = onTransformChange;
  onImageSizeRef.current = onImageSize;
  imageSizeRef.current = imageSize;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const coverW = useSharedValue(viewport.width);
  const coverH = useSharedValue(viewport.height);
  const viewW = useSharedValue(viewport.width);
  const viewH = useSharedValue(viewport.height);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const publish = useCallback(
    (nextScale: number, x: number, y: number, vw: number, vh: number) => {
      if (!mountedRef.current) return;
      onTransformChangeRef.current?.(
        { scale: nextScale, offsetX: x, offsetY: y },
        { width: vw, height: vh },
      );
    },
    [],
  );

  const resetTransform = useCallback(
    (size: ImageSize, vp: LabelCropViewport) => {
      const cover = labelCoverSize(size, vp);
      coverW.value = cover.width;
      coverH.value = cover.height;
      viewW.value = vp.width;
      viewH.value = vp.height;
      scale.value = 1;
      savedScale.value = 1;
      offsetX.value = 0;
      offsetY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
      publish(1, 0, 0, vp.width, vp.height);
    },
    [
      coverH,
      coverW,
      offsetX,
      offsetY,
      publish,
      savedScale,
      savedX,
      savedY,
      scale,
      viewH,
      viewW,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled || !mountedRef.current) return;
        const size = { width, height };
        setImageSize(size);
        onImageSizeRef.current?.(size);
        resetTransform(size, {
          width: viewW.value,
          height: viewH.value,
        });
      },
      () => {
        if (cancelled || !mountedRef.current) return;
        const fallback = { width: 1, height: 1 };
        setImageSize(fallback);
        onImageSizeRef.current?.(fallback);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resetTransform, uri, viewH, viewW]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      // Size the crop frame from width only so controls can sit tight under the photo.
      const maxW = width * 0.82;
      const frameW = maxW;
      const frameH = frameW / LABEL_ASPECT;
      if (frameW <= 1 || frameH <= 1) return;
      const next = { width: frameW, height: frameH };
      setViewport(next);
      viewW.value = next.width;
      viewH.value = next.height;
      const size = imageSizeRef.current;
      if (!size) return;
      const cover = labelCoverSize(size, next);
      coverW.value = cover.width;
      coverH.value = cover.height;
      const clamped = clampLabelOffset(
        offsetX.value,
        offsetY.value,
        size,
        next,
        scale.value,
      );
      offsetX.value = clamped.x;
      offsetY.value = clamped.y;
      savedX.value = clamped.x;
      savedY.value = clamped.y;
      publish(scale.value, clamped.x, clamped.y, next.width, next.height);
    },
    [
      coverH,
      coverW,
      offsetX,
      offsetY,
      publish,
      savedX,
      savedY,
      scale,
      viewH,
      viewW,
    ],
  );

  const gesture = useMemo(() => {
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
        const limX = Math.max(0, (displayW - viewW.value) / 2);
        const limY = Math.max(0, (displayH - viewH.value) / 2);
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
          viewW.value,
          viewH.value,
        );
      });

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onUpdate((e) => {
        'worklet';
        const displayW = coverW.value * scale.value;
        const displayH = coverH.value * scale.value;
        const limX = Math.max(0, (displayW - viewW.value) / 2);
        const limY = Math.max(0, (displayH - viewH.value) / 2);
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
          viewW.value,
          viewH.value,
        );
      });

    return Gesture.Simultaneous(pinch, pan);
  }, [
    coverH,
    coverW,
    offsetX,
    offsetY,
    publish,
    savedScale,
    savedX,
    savedY,
    scale,
    viewH,
    viewW,
  ]);

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
      style={styles.wrap}
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.frame,
            { width: viewport.width, height: viewport.height },
          ]}
          collapsable={false}>
          {imageSize ? (
            <Animated.Image
              source={{ uri }}
              style={[styles.image, imageStyle]}
              resizeMode="stretch"
            />
          ) : null}
          <View pointerEvents="none" style={styles.ring} />
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
    paddingVertical: 2,
  },
  frame: {
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  image: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2.5,
    borderColor: GustraColors.forestGreen,
    borderRadius: 12,
  },
});
