import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { SymbolView } from 'expo-symbols';

import {
  clearOpenSwipeable,
  performOpenSwipeableDelete,
  registerOpenSwipeable,
  updateOpenSwipeableFrame,
} from '@/components/feed/openSwipeable';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import {
  captionTextStyle,
  listPressedStyle,
  Surface,
  Theme,
} from '@/constants/Theme';
import type { Review } from '@/data/types';
import { Haptics } from '@/services/haptics';

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type VisitRowCardProps = {
  review: Review;
  onPress: () => void;
  /** Trailing swipe Delete (Swift `RestaurantVisitsView` swipeActions). */
  onDelete?: () => void;
};

/**
 * Visit row for restaurant visit list (Swift `RestaurantVisitsView.visitRow`).
 */
export function VisitRowCard({ review, onPress, onDelete }: VisitRowCardProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const deleteRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const rowId = `visit_${review.id}`;
  const score = review.overallScore;

  const measureDeleteFrame = () => {
    deleteRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      updateOpenSwipeableFrame(rowId, { x, y, width, height });
    });
  };

  const row = (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.light();
        onPress();
      }}
      android_ripple={
        Platform.OS === 'android'
          ? { color: Theme.list.androidRipple, borderless: false }
          : undefined
      }
      style={({ pressed }) => [
        styles.row,
        Platform.OS === 'ios' && pressed ? listPressedStyle : null,
      ]}>
      <View style={styles.main}>
        <SerifText size={17} weight="semibold" style={styles.date}>
          {formatVisitDate(review.date)}
        </SerifText>
        {score > 0 ? <FractionalStarRating score={score} size={18} /> : null}
      </View>
      {score > 0 ? (
        <SerifText size={20} weight="bold" style={styles.score}>
          {score.toFixed(1)}
        </SerifText>
      ) : null}
    </Pressable>
  );

  if (!onDelete) return row;

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      onSwipeableOpen={() => {
        setIsOpen(true);
        registerOpenSwipeable({
          id: rowId,
          close: () => swipeableRef.current?.close(),
          onDelete,
          deleteFrame: null,
        });
        requestAnimationFrame(() => {
          measureDeleteFrame();
        });
      }}
      onSwipeableClose={() => {
        clearOpenSwipeable(rowId);
        setIsOpen(false);
      }}
      renderRightActions={() => (
        <View
          ref={deleteRef}
          collapsable={false}
          onLayout={() => {
            if (isOpen) measureDeleteFrame();
          }}
          style={styles.deleteButton}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete"
            onPress={() => {
              performOpenSwipeableDelete();
            }}
            style={styles.deletePressable}>
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
        </View>
      )}>
      {row}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: Theme.spacing.cardPadding,
    minHeight: Theme.size.hitTarget,
    backgroundColor: Theme.list.cardBackground,
    borderRadius: Theme.radius.xl,
    ...Surface.raised,
  },
  main: {
    flex: 1,
    gap: 4,
    minHeight: Theme.size.hitTarget,
    justifyContent: 'center',
  },
  date: {
    color: GustraColors.ink,
  },
  score: {
    color: GustraColors.forestGreen,
  },
  deleteButton: {
    width: 88,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: GustraColors.ratingAvoid,
    overflow: 'hidden',
  },
  deletePressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    minHeight: Theme.size.hitTarget,
  },
  deleteLabel: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
