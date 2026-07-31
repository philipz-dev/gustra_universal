import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
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
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { formatLongDate } from '@/i18n/formatDates';
import { Haptics } from '@/services/haptics';
import { isReviewDraft } from '@/services/reviews/draftReview';
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
  const { t } = useAppTranslation();
  const draft = isReviewDraft(review);
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
        {!draft && score > 0 ? (
          <FractionalStarRating score={score} size={18} />
        ) : null}
      </View>
      {draft ? (
        <Text style={styles.draftBadge}>{t('reviews.draftLabel')}</Text>
      ) : score > 0 ? (
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
    paddingHorizontal: 14,
    backgroundColor: Theme.list.cardBackground,
    borderRadius: Platform.OS === 'ios' ? Theme.radius.sm : Theme.radius.xl,
    ...(Platform.OS === 'ios' ? Surface.raised : Surface.flat),
  },
  main: {
    flex: 1,
    gap: 4,
  },
  date: {
    color: GustraColors.ink,
  },
  score: {
    color: GustraColors.forestGreen,
  },
  draftBadge: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '700',
    color: GustraColors.gold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
