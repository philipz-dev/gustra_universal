import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolView } from 'expo-symbols';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
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

/** House destructive — muted avoid red (not iOS system neon). */
const DESTRUCTIVE_RED = GustraColors.ratingAvoid;
const ACTION_WIDTH = Platform.OS === 'ios' ? 74 : 80;

type FeedSwipeDeleteProps = {
  id: string;
  onDelete: () => void;
  children: ReactNode;
  /** Corner radius of the row/card — keeps Delete flush with the trailing edge. */
  cornerRadius?: number;
};

type RightActionsProps = {
  progress: SharedValue<number>;
  cornerRadius: number;
  isOpen: boolean;
  onMeasure: () => void;
  deleteRef: RefObject<View | null>;
};

function RightDeleteActions({
  progress,
  cornerRadius,
  isOpen,
  onMeasure,
  deleteRef,
}: RightActionsProps) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.35, 1],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.88, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
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
          borderTopRightRadius: cornerRadius,
          borderBottomRightRadius: cornerRadius,
        },
      ]}>
      <Animated.View style={[styles.deleteAnimWrap, animStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          onPress={() => {
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
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Swipe-delete via ReanimatedSwipeable — closer to UIKit List swipeActions
 * (`allowsFullSwipe: false`, system red, progress-driven reveal, open haptic).
 */
export function FeedSwipeDelete({
  id,
  onDelete,
  children,
  cornerRadius = Theme.radius.xl,
}: FeedSwipeDeleteProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const deleteRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);

  const measureDeleteFrame = () => {
    deleteRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      updateOpenSwipeableFrame(id, { x, y, width, height });
    });
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1}
      rightThreshold={36}
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
      onSwipeableOpen={() => {
        setIsOpen(true);
        Haptics.selectionChanged();
        registerOpenSwipeable({
          id,
          close: () => swipeableRef.current?.close(),
          onDelete,
          deleteFrame: null,
        });
        requestAnimationFrame(() => {
          measureDeleteFrame();
        });
      }}
      onSwipeableClose={() => {
        clearOpenSwipeable(id);
        setIsOpen(false);
      }}
      renderRightActions={(progress) => (
        <RightDeleteActions
          progress={progress}
          cornerRadius={cornerRadius}
          isOpen={isOpen}
          onMeasure={measureDeleteFrame}
          deleteRef={deleteRef}
        />
      )}>
      {children}
    </ReanimatedSwipeable>
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
    width: ACTION_WIDTH,
    backgroundColor: DESTRUCTIVE_RED,
    justifyContent: 'center',
  },
  deleteAnimWrap: {
    flex: 1,
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
