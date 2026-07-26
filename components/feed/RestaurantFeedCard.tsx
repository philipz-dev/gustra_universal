import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { RestaurantThumb } from '@/components/feed/RestaurantThumb';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import {
  bodyTextStyle,
  captionTextStyle,
  listPressedStyle,
  Surface,
  Theme,
  Type,
} from '@/constants/Theme';
import type { RestaurantVisitSummary } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

type RestaurantFeedCardProps = {
  summary: RestaurantVisitSummary;
  onPress: () => void;
  /** When set, trailing swipe shows Delete (Swift feed swipeActions). */
  onDelete?: () => void;
  onFavoriteToggle?: (favorite: boolean) => void;
  /**
   * When set (e.g. sort by criterion), stars and score use this value
   * instead of overall average — Swift `RestaurantFeedCardView.scoreOverride`.
   */
  scoreOverride?: number | null;
};

export function RestaurantFeedCard({
  summary,
  onPress,
  onDelete,
  onFavoriteToggle,
  scoreOverride,
}: RestaurantFeedCardProps) {
  const { t } = useAppTranslation();
  const displayScore =
    typeof scoreOverride === 'number' ? scoreOverride : summary.averageScore;

  const card = (
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
        styles.card,
        Platform.OS === 'ios' && pressed ? listPressedStyle : null,
      ]}>
      <RestaurantThumb uri={summary.photoUrl} />

      <View style={styles.main}>
        <SerifText size={17} weight="semibold" style={styles.name} numberOfLines={2}>
          {summary.name}
        </SerifText>
        {summary.city ? <Text style={styles.city}>{summary.city}</Text> : null}
        {displayScore > 0 ? (
          <FractionalStarRating score={displayScore} size={24} />
        ) : null}
        <Text style={styles.meta}>
          {summary.visitCount <= 1
            ? summary.lastVisitDate
            : t('reviews.visitCount', {
                count: summary.visitCount,
                date: summary.lastVisitDate,
              })}
        </Text>
        {summary.reviewerName ? (
          <Text style={styles.reviewer}>{summary.reviewerName}</Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {displayScore > 0 ? (
          <SerifText size={20} weight="bold" style={styles.score}>
            {displayScore.toFixed(1)}
          </SerifText>
        ) : null}
        <FavoriteHeartButton
          favorite={summary.isFavorite}
          onToggle={onFavoriteToggle}
        />
      </View>
    </Pressable>
  );

  if (!onDelete) return card;

  return (
    <FeedSwipeDelete
      id={summary.restaurantId}
      onDelete={onDelete}
      cornerRadius={Theme.radius.xl}>
      {card}
    </FeedSwipeDelete>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Theme.spacing.cardPadding,
    minHeight: Theme.size.hitTarget + Theme.spacing.cardPadding,
    backgroundColor: Theme.list.cardBackground,
    borderRadius: Theme.radius.xl,
    // Avoid Android blanking: overflow+radius without elevation hides Text.
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
  name: {
    color: GustraColors.ink,
  },
  city: {
    ...bodyTextStyle,
    fontSize: Type.bodySmall,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  meta: {
    ...captionTextStyle,
    fontSize: Type.label,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  reviewer: {
    ...captionTextStyle,
    fontSize: Type.label,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: Theme.size.hitTarget,
  },
  score: {
    color: GustraColors.forestGreen,
  },
});
