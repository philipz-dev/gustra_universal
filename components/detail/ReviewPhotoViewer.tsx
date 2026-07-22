import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

import {
  PhotoViewerCountPill,
  PhotoViewerShell,
  PhotoViewerTopBar,
} from '@/components/detail/photoViewer/PhotoViewerChrome';
import { ZoomablePhoto } from '@/components/detail/photoViewer/ZoomablePhoto';
import { PhotoViewerStyle } from '@/constants/PhotoViewerStyle';
import {
  savePhotoUri,
  sharePhotoUri,
} from '@/services/photos/photoViewerActions';

type ReviewPhotoViewerProps = {
  visible: boolean;
  uris: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/**
 * Full-screen review photo pager (Swift `ReviewPhotoViewer` cinematic chrome).
 */
export function ReviewPhotoViewer({
  visible,
  uris,
  index,
  onIndexChange,
  onClose,
}: ReviewPhotoViewerProps) {
  const pageWidth = useRef(Dimensions.get('window').width).current;
  const scrollRef = useRef<ScrollView>(null);
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      dismissY.value = 0;
      setZoomed(false);
      return;
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: index * pageWidth, animated: false });
    });
  }, [visible, index, pageWidth, dismissY]);

  const close = useCallback(() => {
    dismissY.value = 0;
    onClose();
  }, [dismissY, onClose]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < uris.length) {
      onIndexChange(next);
      setZoomed(false);
    }
  };

  const handleShare = useCallback(async () => {
    const uri = uris[index];
    if (!uri || busy) return;
    setBusy(true);
    try {
      await sharePhotoUri(uri);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not share photo',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, index, uris]);

  const handleSave = useCallback(async () => {
    const uri = uris[index];
    if (!uri || busy) return;
    setBusy(true);
    try {
      await savePhotoUri(uri);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not save photo',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, index, uris]);

  const dismissGesture = Gesture.Pan()
    .enabled(!zoomed)
    .activeOffsetY([-20, 20])
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      dismissY.value = e.translationY;
    })
    .onEnd((e) => {
      const dy = e.translationY;
      const shouldDismiss =
        Math.abs(dy) >= PhotoViewerStyle.dismissThreshold ||
        Math.abs(e.velocityY) >= PhotoViewerStyle.dismissVelocityThreshold;
      if (shouldDismiss) {
        runOnJS(close)();
      } else {
        dismissY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const contentStyle = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      Math.abs(dismissY.value) / PhotoViewerStyle.dismissThreshold,
    );
    return {
      transform: [
        { translateY: dismissY.value },
        { scale: 1 - progress * 0.04 },
      ],
    };
  });

  const currentUri = uris[index];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={close}
      statusBarTranslucent>
      {visible ? <StatusBar style="light" hidden /> : null}
      <PhotoViewerShell dismissY={dismissY}>
        <GestureDetector gesture={dismissGesture}>
          <Animated.View style={[styles.content, contentStyle]}>
            {uris.length === 1 && currentUri ? (
              <ZoomablePhoto
                uri={currentUri}
                isActive
                accessibilityLabel="Review photo"
                onZoomChange={setZoomed}
              />
            ) : (
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                scrollEnabled={!zoomed}
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={styles.pager}
                contentOffset={{ x: index * pageWidth, y: 0 }}>
                {uris.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={{ width: pageWidth }}>
                    <ZoomablePhoto
                      uri={uri}
                      isActive={i === index}
                      accessibilityLabel="Review photo"
                      onZoomChange={(isZoomed) => {
                        if (i === index) setZoomed(isZoomed);
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </GestureDetector>

        <PhotoViewerTopBar
          onClose={close}
          onShare={() => void handleShare()}
          onSave={() => void handleSave()}
        />

        <PhotoViewerCountPill
          text={`${index + 1} / ${uris.length}`}
          visible={uris.length > 1 && !zoomed}
          dismissY={dismissY}
        />
      </PhotoViewerShell>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
});
