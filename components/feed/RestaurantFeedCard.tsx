import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RestaurantThumb } from '@/components/feed/RestaurantThumb';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { SatisfactionDot } from '@/components/ui/SatisfactionDot';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle, Theme } from '@/constants/Theme';

import { satisfactionFromScore, type RestaurantVisitSummary } from '@/data/types';

type RestaurantFeedCardProps = {
  summary: RestaurantVisitSummary;
  onPress: () => void;
};

export function RestaurantFeedCard({ summary, onPress }: RestaurantFeedCardProps) {
  const level = satisfactionFromScore(summary.averageScore);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <RestaurantThumb
        uri={summary.photoUrl}
        fallbackColor={summary.thumbnailColor}
      />

      <View style={styles.main}>
        <SerifText size={17} weight="semibold" style={styles.name} numberOfLines={2}>
          {summary.name}
        </SerifText>
        {summary.city ? <Text style={styles.city}>{summary.city}</Text> : null}
        {summary.averageScore > 0 ? (
          <FractionalStarRating score={summary.averageScore} size={24} />
        ) : null}
        <Text style={styles.meta}>
          {summary.visitCount <= 1
            ? summary.lastVisitDate
            : `${summary.visitCount} visits · ${summary.lastVisitDate}`}
        </Text>
        {summary.reviewerName ? (
          <Text style={styles.reviewer}>{summary.reviewerName}</Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {summary.averageScore > 0 ? (
          <>
            <SerifText size={20} weight="bold" style={styles.score}>
              {summary.averageScore.toFixed(1)}
            </SerifText>
            <SatisfactionDot level={level} />
          </>
        ) : null}
        <FavoriteHeartButton initialFavorite={summary.isFavorite} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Theme.spacing.cardPadding,
    backgroundColor: 'rgba(236, 227, 207, 0.6)',
    borderRadius: Theme.radius.xl,
  },
  pressed: {
    opacity: 0.92,
  },
  main: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: GustraColors.ink,
  },
  city: {
    ...bodyTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  meta: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  reviewer: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },

  trailing: {
    alignItems: 'flex-end',
    gap: 6,
  },
  score: {
    color: GustraColors.forestGreen,
  },
});
