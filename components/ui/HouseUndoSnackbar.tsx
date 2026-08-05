import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';

export type HouseUndoSnackbarRequest = {
  message: string;
  /**
   * Optional action button label. When omitted the snackbar is purely
   * informational (no Undo button) — used for save confirmations.
   */
  actionLabel?: string;
  /** Auto-commit after this many ms (default 4500). */
  durationMs?: number;
  onUndo: () => void;
  /** Called when the window expires without Undo. */
  onCommit: () => void;
};

type Listener = (request: HouseUndoSnackbarRequest | null) => void;

let listener: Listener | null = null;
let active: HouseUndoSnackbarRequest | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function publish(request: HouseUndoSnackbarRequest | null) {
  listener?.(request);
}

/**
 * Material-style undo snackbar (Android delete pattern).
 * Only one active: a new request commits the previous pending action.
 */
export function showHouseUndoSnackbar(
  request: HouseUndoSnackbarRequest,
): void {
  if (active) {
    clearTimer();
    const previous = active;
    active = null;
    previous.onCommit();
  }
  active = request;
  if (!listener) return;
  publish(request);
}

export function dismissHouseUndoSnackbar(commit = true): void {
  clearTimer();
  const current = active;
  active = null;
  publish(null);
  if (current && commit) current.onCommit();
}

function subscribe(next: Listener): () => void {
  listener = next;
  if (active) publish(active);
  return () => {
    if (listener === next) listener = null;
  };
}

/**
 * Root host — mount once next to `HouseAlertHost`.
 */
export function HouseUndoSnackbarHost() {
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<HouseUndoSnackbarRequest | null>(
    null,
  );
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    return subscribe((next) => {
      clearTimer();
      setRequest(next);
      if (!next) return;
      Haptics.medium();
      const duration = next.durationMs ?? 4500;
      timer = setTimeout(() => {
        const current = active;
        active = null;
        setRequest(null);
        timer = null;
        current?.onCommit();
      }, duration);
    });
  }, []);

  if (!request) return null;

  const actionLabel = request.actionLabel ?? null;
  const bottom =
    Theme.spacing.floatingTabBarClearance + Math.max(insets.bottom, 8);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: bottom }]}>
      <View style={styles.bar} accessibilityLiveRegion="polite">
        <Text style={styles.message} numberOfLines={2}>
          {request.message}
        </Text>
        {actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={() => {
              clearTimer();
              const current = active;
              active = null;
              setRequest(null);
              Haptics.light();
              current?.onUndo();
            }}
            style={({ pressed }) => [
              styles.action,
              pressed && styles.actionPressed,
            ]}>
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: Theme.spacing.detailContent,
    zIndex: 1000,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: GustraColors.ink,
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: Theme.size.hitTarget,
  },
  message: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 15,
    color: GustraColors.cream,
  },
  action: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: Theme.size.hitTarget,
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    ...bodyTextStyle,
    fontSize: 15,
    fontWeight: '700',
    color: GustraColors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
