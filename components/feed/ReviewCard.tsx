import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RestaurantThumb } from '@/components/feed/RestaurantThumb';
import { SatisfactionDot } from '@/components/ui/SatisfactionDot';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle, Theme } from '@/constants/Theme';

import { formatReviewDate } from '@/data/mockReviews';
import { satisfactionFromScore, type Review } from '@/data/types';

type ReviewCardProps = {
  review: Review;
  restaurantName: string;
  city: string;
  thumbnailColor: string;
  photoUrl?: string;
  onPress: () => void;
};

export function ReviewCard({
  review,
  restaurantName,
  city,
  thumbnailColor,
  photoUrl,
  onPress,
}: ReviewCardProps) {
  const level = satisfactionFromScore(review.overallScore);
  const uri = review.photoUrls[0] ?? photoUrl;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <RestaurantThumb uri={uri} fallbackColor={thumbnailColor} />
      <View style={styles.main}>
        <SerifText size={17} weight="semibold" style={styles.name} numberOfLines={2}>
          {restaurantName}
        </SerifText>
        {city ? <Text style={styles.city}>{city}</Text> : null}
        <FractionalStarRating score={review.overallScore} size={24} />
        <Text style={styles.meta}>{formatReviewDate(review.date)}</Text>
      </View>
      <View style={styles.trailing}>
        <SerifText size={20} weight="bold" style={styles.score}>
          {review.overallScore.toFixed(1)}
        </SerifText>
        <SatisfactionDot level={level} />
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

  trailing: {
    alignItems: 'flex-end',
    gap: 6,
  },
  score: {
    color: GustraColors.forestGreen,
  },
});
