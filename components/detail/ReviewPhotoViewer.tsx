import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView as RNScrollView,
  StyleSheet,
  View,
} from 'react-native';
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

/** Swift `ReviewPhotoViewer` HStack spacing between pages. */
const PAGE_GAP = 16;

/**
 * Full-screen review photo pager (Swift `ReviewPhotoViewer` cinematic chrome).
 *
 * Android: native ScrollView + no parent dismiss pan around the pager
 * (gesture wrappers were stealing horizontal swipes).
 * iOS: RNGH ScrollView + vertical dismiss pan.
 */
export function ReviewPhotoViewer({
  visible,
  uris,
  index,
  onIndexChange,
  onClose,
}: ReviewPhotoViewerProps) {
  const pageWidth = useRef(Dimensions.get('window').width).current;
  const pageStride = pageWidth + PAGE_GAP;
  const rnScrollRef = useRef<RNScrollView>(null);
  const ghScrollRef = useRef<GHScrollView>(null);
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissY = useSharedValue(0);
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    if (!visible) {
      dismissY.value = 0;
      setZoomed(false);
      return;
    }
    const x = index * pageStride;
    const id = requestAnimationFrame(() => {
      if (Platform.OS === 'android') {
        rnScrollRef.current?.scrollTo({ x, animated: false });
      } else {
        ghScrollRef.current?.scrollTo({ x, animated: false });
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open sync only
  }, [visible, pageStride, dismissY]);

  const close = useCallback(() => {
    dismissY.value = 0;
    onClose();
  }, [dismissY, onClose]);

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
    .enabled(!zoomed && !isAndroid)
    .activeOffsetY([-20, 20])
    .failOffsetX([-10, 10])
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

  const pagerProps = {
    horizontal: true as const,
    // snapToInterval (not pagingEnabled) so PAGE_GAP shows between photos.
    pagingEnabled: false,
    snapToInterval: pageStride,
    snapToAlignment: 'start' as const,
    disableIntervalMomentum: true,
    bounces: false,
    scrollEnabled: !zoomed,
    showsHorizontalScrollIndicator: false,
    onScroll,
    scrollEventThrottle: 16,
    style: styles.pager,
    decelerationRate: 'fast' as const,
  };

  const pager = isAndroid ? (
    <RNScrollView
      ref={rnScrollRef}
      {...pagerProps}
      removeClippedSubviews={false}>
      {pages}
    </RNScrollView>
  ) : (
    <GHScrollView ref={ghScrollRef} {...pagerProps}>
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
      statusBarTranslucent>
      {visible ? <StatusBar style="light" hidden /> : null}
      <GestureHandlerRootView style={styles.root}>
        <PhotoViewerShell dismissY={dismissY}>
          {isAndroid ? (
            <View style={styles.content}>{body}</View>
          ) : (
            <GestureDetector gesture={dismissGesture}>
              <Animated.View style={[styles.content, contentStyle]}>
                {body}
              </Animated.View>
            </GestureDetector>
          )}

          <PhotoViewerTopBar
            onClose={close}
            onShare={() => void handleShare()}
            onSave={() => void handleSave()}
          />

          <PhotoViewerCountPill
            text={`${index + 1} / ${uris.length}`}
            visible={uris.length > 1 && !zoomed}
            dismissY={isAndroid ? undefined : dismissY}
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
