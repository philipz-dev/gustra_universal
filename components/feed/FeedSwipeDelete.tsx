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
import { captionTextStyle, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';
import { useAppTranslation } from '@/hooks/useAppTranslation';

/** iOS system destructive red (UIColor.systemRed light). */
const IOS_DESTRUCTIVE_RED = '#FF3B30';
/** Peek / threshold width — past this on release, row commits full swipe. */
const ACTION_WIDTH = Platform.OS === 'ios' ? 74 : 80;
/** Release past this fraction of the row → full swipe delete. */
const FULL_SWIPE_FRACTION = 0.38;

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
  deleteRef,
  deleteLabel,
}: RightActionsProps) {
  const panelWidth = rowWidth > 0 ? rowWidth : ACTION_WIDTH;
  const thresholdPx = Math.max(ACTION_WIDTH, panelWidth * FULL_SWIPE_FRACTION);

  useAnimatedReaction(
    () => -translation.value,
    (drag, prev) => {
      const passed = drag >= thresholdPx;
      const wasPassed = (prev ?? 0) >= thresholdPx;
      if (passed !== wasPassed) {
        runOnJS(onPassFullThreshold)(passed);
      }
    },
    [thresholdPx, onPassFullThreshold],
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.2, 1],
      [0, 0.7, 1],
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
      style={[
        styles.deleteAction,
        {
          width: panelWidth,
          borderTopRightRadius: cornerRadius,
          borderBottomRightRadius: cornerRadius,
        },
      ]}>
      <Animated.View style={[styles.deleteAnimWrap, animStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={() => {
            Haptics.warning();
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
 * Swipe-delete via ReanimatedSwipeable — iOS system red, open/commit haptics,
 * full-swipe past ~38% of the row commits delete (card flies off, then confirm).
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

  const deleteLabel = t('common.delete');
  /** Release past ~delete-button width → snap fully open (card flies off). */
  const rightThreshold = ACTION_WIDTH * 0.65;

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
    Haptics.warning();
    // Bring the row back under the confirm alert; Cancel restores the card.
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
        friction={1}
        rightThreshold={rightThreshold}
        dragOffsetFromRightEdge={16}
        overshootRight={false}
        overshootFriction={8}
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
          // Full-width actions: open == committed full swipe → confirm delete.
          triggerDeleteFromFullSwipe();
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
  deleteAction: {
    backgroundColor: IOS_DESTRUCTIVE_RED,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  deleteAnimWrap: {
    width: ACTION_WIDTH,
    height: '100%',
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
