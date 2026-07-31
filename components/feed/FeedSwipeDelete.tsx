import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolView } from 'expo-symbols';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  clearOpenSwipeable,
  performOpenSwipeableDelete,
  registerOpenSwipeable,
  updateOpenSwipeableFrame,
} from '@/components/feed/openSwipeable';
import { GustraColors } from '@/constants/Colors';
import { captionTextStyle, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';
import { useAppTranslation } from '@/hooks/useAppTranslation';

/** Peek width — open snap target (Mail-style action button). */
const ACTION_WIDTH = Platform.OS === 'ios' ? 74 : 80;
/** Release / drag past this fraction of the row → commit full-swipe delete. */
const FULL_SWIPE_FRACTION = 0.5;
/** Gesture friction — higher = more resistance (closer to UIKit). */
const SWIPE_FRICTION = Platform.OS === 'ios' ? 2 : 1.5;
const OVERSHOOT_FRICTION = Platform.OS === 'ios' ? 8 : 6;

type FeedSwipeDeleteProps = {
  id: string;
  onDelete: () => void;
  children: ReactNode;
  /** Corner radius of the row/card — keeps Delete flush with the trailing edge. */
  cornerRadius?: number;
};

type RightActionsProps = {
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  rowWidth: number;
  cornerRadius: number;
  isOpen: boolean;
  onMeasure: () => void;
  onPassFullThreshold: (passed: boolean) => void;
  onFullSwipeCommit: () => void;
  deleteRef: RefObject<View | null>;
  deleteLabel: string;
};

function RightDeleteActions({
  progress,
  translation,
  rowWidth,
  cornerRadius,
  isOpen,
  onMeasure,
  onPassFullThreshold,
  onFullSwipeCommit,
  deleteRef,
  deleteLabel,
}: RightActionsProps) {
  const thresholdPx = Math.max(
    ACTION_WIDTH * 1.35,
    rowWidth > 0 ? rowWidth * FULL_SWIPE_FRACTION : ACTION_WIDTH * 2,
  );

  useAnimatedReaction(
    () => -translation.value,
    (drag, prev) => {
      const passed = drag >= thresholdPx;
      const wasPassed = (prev ?? 0) >= thresholdPx;
      if (passed !== wasPassed) {
        runOnJS(onPassFullThreshold)(passed);
      }
      // Mid-drag past ~half row → commit (Mail full-swipe).
      if (passed && !wasPassed) {
        runOnJS(onFullSwipeCommit)();
      }
    },
    [thresholdPx, onPassFullThreshold, onFullSwipeCommit],
  );

  // Stretch house-red under the card while overshooting past the peek button.
  const stretchStyle = useAnimatedStyle(() => {
    const revealed = Math.max(ACTION_WIDTH, -translation.value);
    return {
      width: revealed,
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.35, 1],
      [0, 0.85, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View
      ref={deleteRef}
      collapsable={false}
      onLayout={() => {
        if (isOpen) onMeasure();
      }}
      style={[styles.actionSlot, { width: ACTION_WIDTH }]}>
      <Animated.View
        style={[
          styles.deleteStretch,
          stretchStyle,
          {
            borderTopRightRadius: cornerRadius,
            borderBottomRightRadius: cornerRadius,
          },
        ]}
      />
      <Animated.View style={[styles.deleteAnimWrap, contentStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={() => {
            Haptics.medium();
            performOpenSwipeableDelete();
          }}
          style={({ pressed }) => [
            styles.deletePressable,
            pressed && styles.deletePressed,
          ]}>
          <SymbolView
            name={{
              ios: 'trash.fill',
              android: 'delete',
              web: 'delete',
            }}
            tintColor="#FFFFFF"
            size={22}
          />
          <Text style={styles.deleteLabel}>{deleteLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Swipe-delete via ReanimatedSwipeable (Mail-like peek + full-swipe).
 * Caller should use `requestSwipeDelete` for platform UX:
 * iOS system confirm, Android Undo snackbar (+ haptics).
 */
export function FeedSwipeDelete({
  id,
  onDelete,
  children,
  cornerRadius = Theme.radius.xl,
}: FeedSwipeDeleteProps) {
  const { t } = useAppTranslation();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const deleteRef = useRef<View>(null);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const fullSwipeCommittedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);

  const deleteLabel = t('common.deleteSwipe');
  /** Peek open threshold — half the action button. */
  const rightThreshold = ACTION_WIDTH * 0.45;

  const measureDeleteFrame = useCallback(() => {
    deleteRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      updateOpenSwipeableFrame(id, { x, y, width, height });
    });
  }, [id]);

  const onPassFullThreshold = useCallback((passed: boolean) => {
    if (passed) {
      Haptics.medium();
    }
  }, []);

  const triggerDeleteFromFullSwipe = useCallback(() => {
    if (fullSwipeCommittedRef.current) return;
    fullSwipeCommittedRef.current = true;
    // Haptic already fired when crossing the full-swipe threshold.
    // Snap back under confirm / Undo; Cancel restores the card.
    swipeableRef.current?.close();
    onDeleteRef.current();
  }, []);

  const onRowLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0) setRowWidth(width);
  }, []);

  return (
    <View onLayout={onRowLayout}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={SWIPE_FRICTION}
        rightThreshold={rightThreshold}
        dragOffsetFromRightEdge={Platform.OS === 'ios' ? 20 : 16}
        overshootRight
        overshootFriction={OVERSHOOT_FRICTION}
        enableTrackpadTwoFingerGesture
        containerStyle={[
          styles.container,
          { borderRadius: cornerRadius },
        ]}
        childrenContainerStyle={
          Platform.OS === 'android'
            ? [styles.childrenAndroid, { borderRadius: cornerRadius }]
            : undefined
        }
        onSwipeableOpenStartDrag={() => {
          fullSwipeCommittedRef.current = false;
          Haptics.selectionChanged();
        }}
        onSwipeableOpen={() => {
          setIsOpen(true);
          registerOpenSwipeable({
            id,
            close: () => swipeableRef.current?.close(),
            onDelete: () => onDeleteRef.current(),
            deleteFrame: null,
          });
          requestAnimationFrame(() => {
            measureDeleteFrame();
          });
          // Peek stays open — full-swipe commit is handled via translation threshold.
        }}
        onSwipeableClose={() => {
          clearOpenSwipeable(id);
          setIsOpen(false);
          fullSwipeCommittedRef.current = false;
        }}
        renderRightActions={(progress, translation) => (
          <RightDeleteActions
            progress={progress}
            translation={translation}
            rowWidth={rowWidth}
            cornerRadius={cornerRadius}
            isOpen={isOpen}
            onMeasure={measureDeleteFrame}
            onPassFullThreshold={onPassFullThreshold}
            onFullSwipeCommit={triggerDeleteFromFullSwipe}
            deleteRef={deleteRef}
            deleteLabel={deleteLabel}
          />
        )}>
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  /** Avoid Android elevation “mat” outside the rounded card. */
  childrenAndroid: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  actionSlot: {
    height: '100%',
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  deleteStretch: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    /** House `ratingAvoid` — keep brand red (not system neon). */
    backgroundColor: GustraColors.ratingAvoid,
  },
  deleteAnimWrap: {
    width: ACTION_WIDTH,
    height: '100%',
    zIndex: 1,
  },
  deletePressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    minHeight: Theme.size.hitTarget,
  },
  deletePressed: {
    opacity: 0.85,
  },
  deleteLabel: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
