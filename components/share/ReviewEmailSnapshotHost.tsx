import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';

import {
  EMAIL_CARD_OUTER_WIDTH,
  ReviewEmailCardView,
} from '@/components/share/ReviewEmailCardView';
import {
  completeEmailSnapshot,
  failEmailSnapshot,
  subscribeEmailSnapshot,
  type EmailSnapshotRequest,
} from '@/services/share/ReviewEmailSnapshot';

const CAPTURE_TIMEOUT_MS = 12_000;

/**
 * Off-screen host that renders `ReviewEmailCardView` and captures JPEG
 * (Swift `ReviewEmailSnapshotService` + ImageRenderer).
 *
 * Avoid `InteractionManager.runAfterInteractions` here: a visible preparing
 * Modal (or dismiss animation) can keep interactions busy forever, so the
 * capture never runs and the UI appears frozen.
 */
export function ReviewEmailSnapshotHost() {
  const [request, setRequest] = useState<EmailSnapshotRequest | null>(null);
  const [photosReady, setPhotosReady] = useState(false);
  const cardRef = useRef<View>(null);
  const capturing = useRef(false);
  const onPhotosReady = useCallback(() => setPhotosReady(true), []);

  useEffect(() => subscribeEmailSnapshot(setRequest), []);

  useEffect(() => {
    setPhotosReady(false);
    capturing.current = false;
  }, [request]);

  // Don't hang forever if a remote photo never finishes loading.
  useEffect(() => {
    if (!request || photosReady) return;
    const timeout = setTimeout(() => setPhotosReady(true), 4000);
    return () => clearTimeout(timeout);
  }, [request, photosReady]);

  // Hard stop if capture never completes (view-shot / layout hang).
  useEffect(() => {
    if (!request) return;
    const timeout = setTimeout(() => {
      failEmailSnapshot(
        new Error('Could not create the visual recommendation.'),
      );
    }, CAPTURE_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [request]);

  useEffect(() => {
    if (!request || !photosReady || capturing.current) return;
    capturing.current = true;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (cancelled || !cardRef.current) {
            throw new Error('Email card was not ready to capture.');
          }
          const tmpUri = await captureRef(cardRef, {
            format: 'jpg',
            quality: 0.82,
            result: 'tmpfile',
          });
          const cacheRoot = FileSystem.cacheDirectory;
          if (!cacheRoot) {
            throw new Error('Cache directory unavailable.');
          }
          const dest = `${cacheRoot}${request.fileName}`;
          const info = await FileSystem.getInfoAsync(dest);
          if (info.exists) {
            await FileSystem.deleteAsync(dest, { idempotent: true });
          }
          await FileSystem.copyAsync({ from: tmpUri, to: dest });
          if (!cancelled) completeEmailSnapshot(dest);
        } catch (error) {
          if (!cancelled) {
            failEmailSnapshot(
              error instanceof Error
                ? error
                : new Error('Could not create the visual recommendation.'),
            );
          }
        }
      })();
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request, photosReady]);

  if (!request) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
        <ReviewEmailCardView
          {...request.card}
          onPhotosReady={onPhotosReady}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep on-screen (near-invisible) so Android still composites the view tree.
  host: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: EMAIL_CARD_OUTER_WIDTH,
    opacity: 0.02,
    zIndex: 0,
  },
  cardWrap: {
    width: EMAIL_CARD_OUTER_WIDTH,
  },
});
