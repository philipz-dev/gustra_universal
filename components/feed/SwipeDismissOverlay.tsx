import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  dismissOpenSwipeable,
  getOpenSwipeableSnapshot,
  subscribeOpenSwipeable,
  type DeleteFrame,
} from '@/components/feed/openSwipeable';

type Origin = { x: number; y: number };

/**
 * Full-screen dismiss layer while a feed swipe-delete is open.
 * Uses a pass-through “hole” over the real Delete button (same window —
 * avoids Android Modal + measureInWindow misalignment).
 */
export function SwipeDismissOverlay() {
  const open = useSyncExternalStore(
    subscribeOpenSwipeable,
    getOpenSwipeableSnapshot,
    () => null,
  );
  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    rootRef.current?.measureInWindow((x, y) => {
      setOrigin({ x, y });
    });
  }, [open, open?.deleteFrame?.x, open?.deleteFrame?.y, open?.deleteFrame?.width, open?.deleteFrame?.height]);

  if (!open) return null;

  const hole = toLocalFrame(open.deleteFrame, origin);

  return (
    <View
      ref={rootRef}
      collapsable={false}
      pointerEvents="box-none"
      style={styles.root}>
      {hole ? (
        <>
          <Pressable
            accessibilityLabel="Dismiss delete"
            onPress={dismissOpenSwipeable}
            style={[styles.zone, { top: 0, left: 0, right: 0, height: hole.top }]}
          />
          <Pressable
            accessibilityLabel="Dismiss delete"
            onPress={dismissOpenSwipeable}
            style={[
              styles.zone,
              {
                top: hole.top,
                left: 0,
                width: hole.left,
                height: hole.height,
              },
            ]}
          />
          <Pressable
            accessibilityLabel="Dismiss delete"
            onPress={dismissOpenSwipeable}
            style={[
              styles.zone,
              {
                top: hole.top,
                left: hole.left + hole.width,
                right: 0,
                height: hole.height,
              },
            ]}
          />
          <Pressable
            accessibilityLabel="Dismiss delete"
            onPress={dismissOpenSwipeable}
            style={[
              styles.zone,
              {
                top: hole.top + hole.height,
                left: 0,
                right: 0,
                bottom: 0,
              },
            ]}
          />
        </>
      ) : (
        <Pressable
          accessibilityLabel="Dismiss delete"
          onPress={dismissOpenSwipeable}
          style={styles.zoneFill}
        />
      )}
    </View>
  );
}

function toLocalFrame(
  frame: DeleteFrame | null,
  origin: Origin,
): { left: number; top: number; width: number; height: number } | null {
  if (!frame || frame.width <= 0 || frame.height <= 0) return null;
  return {
    left: frame.x - origin.x,
    top: frame.y - origin.y,
    width: frame.width,
    height: frame.height,
  };
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  zone: {
    position: 'absolute',
  },
  zoneFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
