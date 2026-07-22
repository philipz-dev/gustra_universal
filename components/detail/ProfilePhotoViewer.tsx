import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet } from 'react-native';
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

type ProfilePhotoViewerProps = {
  visible: boolean;
  uri: string;
  onClose: () => void;
};

/** Full-screen reviewer / profile photo (Swift `ProfilePhotoViewer`). */
export function ProfilePhotoViewer({
  visible,
  uri,
  onClose,
}: ProfilePhotoViewerProps) {
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      dismissY.value = 0;
      setZoomed(false);
    }
  }, [visible, dismissY]);

  const close = useCallback(() => {
    dismissY.value = 0;
    onClose();
  }, [dismissY, onClose]);

  const handleShare = useCallback(async () => {
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
  }, [busy, uri]);

  const handleSave = useCallback(async () => {
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
  }, [busy, uri]);

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
            <ZoomablePhoto
              uri={uri}
              isActive={visible}
              accessibilityLabel="Profile photo"
              onZoomChange={setZoomed}
            />
          </Animated.View>
        </GestureDetector>

        <PhotoViewerTopBar
          onClose={close}
          onShare={() => void handleShare()}
          onSave={() => void handleSave()}
        />

        <PhotoViewerCountPill
          text="Profile photo"
          visible={!zoomed}
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
});
