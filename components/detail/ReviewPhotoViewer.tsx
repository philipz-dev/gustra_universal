import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
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
  lockAppPortraitOrientation,
  unlockPhotoViewerOrientation,
} from '@/services/orientation/photoViewerOrientation';
import { sharePhotoUri, savePhotoUri } from '@/services/photos/photoViewerActions';

type ReviewPhotoViewerProps = {
  visible: boolean;
  uris: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Swift `ReviewPhotoViewer` HStack spacing between pages. */
const PAGE_GAP = 16;

/**
 * Full-screen review photo pager (Swift `ReviewPhotoViewer` cinematic chrome).
 * GHScrollView + vertical dismiss on both platforms; pinch zoom with pan only when zoomed.
 */
export function ReviewPhotoViewer({
  visible,
  uris,
  index,
  onIndexChange,
  onClose,
}: ReviewPhotoViewerProps) {
  const { width: pageWidth } = useWindowDimensions();
  const pageStride = pageWidth + PAGE_GAP;
  const ghScrollRef = useRef<GHScrollView>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const [zoomed, setZoomed] = useState(false);
  const [dismissDragging, setDismissDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      void lockAppPortraitOrientation();
      dismissY.value = 0;
      setZoomed(false);
      setDismissDragging(false);
      return;
    }
    void unlockPhotoViewerOrientation();
    return () => {
      void lockAppPortraitOrientation();
    };
  }, [visible, dismissY]);

  const scrollToIndex = useCallback(
    (targetIndex: number, animated: boolean) => {
      const x = targetIndex * pageStride;
      ghScrollRef.current?.scrollTo({ x, animated });
    },
    [pageStride],
  );

  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => {
      scrollToIndex(indexRef.current, false);
    });
    return () => cancelAnimationFrame(id);
  }, [visible, pageStride, scrollToIndex]);

  const close = useCallback(() => {
    dismissY.value = 0;
    setDismissDragging(false);
    void lockAppPortraitOrientation();
    onClose();
  }, [dismissY, onClose]);

  const markDismissDragging = useCallback((next: boolean) => {
    setDismissDragging(next);
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageStride);
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
      houseAlert(
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
      houseAlert('Photo saved');
    } catch (error) {
      houseAlert(
        'Error',
        error instanceof Error ? error.message : 'Could not save photo',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, index, uris]);

  // Swift: activate only when |dy| > |dx| * 1.2 so horizontal paging wins otherwise.
  const dismissGesture = Gesture.Pan()
    .enabled(!zoomed)
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      touchStartX.value = t.absoluteX;
      touchStartY.value = t.absoluteY;
    })
    .onTouchesMove((e, state) => {
      if (e.numberOfTouches > 1) {
        state.fail();
        return;
      }
      const t = e.allTouches[0];
      if (!t) return;
      const dx = t.absoluteX - touchStartX.value;
      const dy = t.absoluteY - touchStartY.value;
      if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        state.activate();
      } else if (Math.abs(dx) > 12 && Math.abs(dx) >= Math.abs(dy)) {
        state.fail();
      }
    })
    .onStart(() => {
      runOnJS(markDismissDragging)(true);
    })
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
        runOnJS(markDismissDragging)(false);
      }
    })
    .onFinalize((_e, success) => {
      if (!success) {
        runOnJS(markDismissDragging)(false);
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

  const pages = uris.map((uri, i) => (
    <View
      key={`${uri}-${i}`}
      style={[
        styles.page,
        {
          width: pageWidth,
          marginRight: i === uris.length - 1 ? 0 : PAGE_GAP,
        },
      ]}
      collapsable={false}>
      <ZoomablePhoto
        uri={uri}
        isActive={i === index && visible}
        accessibilityLabel="Review photo"
        pagingFriendly
        onZoomChange={(isZoomed) => {
          if (i === index) setZoomed(isZoomed);
        }}
      />
    </View>
  ));

  const pager = (
    <GHScrollView
      key={`pager-${pageWidth}`}
      ref={ghScrollRef}
      horizontal
      // snapToInterval (not pagingEnabled) so PAGE_GAP shows between photos.
      pagingEnabled={false}
      snapToInterval={pageStride}
      snapToAlignment="start"
      disableIntervalMomentum
      bounces={false}
      scrollEnabled={!zoomed && !dismissDragging}
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={styles.pager}
      decelerationRate="fast">
      {pages}
    </GHScrollView>
  );

  const body =
    uris.length === 1 && currentUri ? (
      <ZoomablePhoto
        uri={currentUri}
        isActive
        accessibilityLabel="Review photo"
        onZoomChange={setZoomed}
      />
    ) : (
      pager
    );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={close}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
      statusBarTranslucent>
      {visible ? <StatusBar style="light" hidden /> : null}
      <GestureHandlerRootView style={styles.root}>
        <PhotoViewerShell dismissY={dismissY}>
          <GestureDetector gesture={dismissGesture}>
            <Animated.View style={[styles.content, contentStyle]}>
              {body}
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
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
