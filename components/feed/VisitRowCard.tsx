import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { listPressedStyle, Surface, Theme } from '@/constants/Theme';
import type { Review } from '@/data/types';
import { formatLongDate } from '@/i18n/formatDates';
import { Haptics } from '@/services/haptics';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';

function formatVisitDate(iso: string): string {
  return formatLongDate(iso);
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
  const score = review.overallScore;

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
      style={({ pressed }) =>
        [
          styles.row,
          Platform.OS === 'ios' && pressed
            ? (listPressedStyle as ViewStyle)
            : null,
        ] as ViewStyle[]
      }>
      <View style={styles.main}>
        <SerifText size={17} weight="semibold" style={styles.date}>
          {formatVisitDate(review.date)}
        </SerifText>
        {score > 0 ? <FractionalStarRating score={score} size={18} /> : null}
      </View>
      {score > 0 ? (
        <SerifText size={20} weight="bold" style={styles.score}>
          {formatScoreOutOfFive(score)}
        </SerifText>
      ) : null}
    </Pressable>
  );

  if (!onDelete) return row;

  return (
    <FeedSwipeDelete
      id={`visit_${review.id}`}
      onDelete={onDelete}
      cornerRadius={Platform.OS === 'ios' ? Theme.radius.sm : Theme.radius.xl}>
      {row}
    </FeedSwipeDelete>
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
    borderRadius: Platform.OS === 'ios' ? Theme.radius.sm : Theme.radius.xl,
    ...(Platform.OS === 'ios'
      ? { overflow: 'hidden' as const, ...Surface.raised }
      : { overflow: 'visible' as const, ...Surface.flat }),
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
});
