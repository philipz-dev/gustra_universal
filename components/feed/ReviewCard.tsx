import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { RestaurantThumb } from '@/components/feed/RestaurantThumb';
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

import { formatReviewDate } from '@/data/mockReviews';
import type { Review } from '@/data/types';
import { Haptics } from '@/services/haptics';

type ReviewCardProps = {
  review: Review;
  restaurantName: string;
  city: string;
  photoUrl?: string;
  onPress: () => void;
};

export function ReviewCard({
  review,
  restaurantName,
  city,
  photoUrl,
  onPress,
}: ReviewCardProps) {
  const uri = review.photoUrls[0] ?? photoUrl;

  return (
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
      <RestaurantThumb uri={uri} />
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
    minHeight: Theme.size.hitTarget + Theme.spacing.cardPadding,
    backgroundColor: Theme.list.cardBackground,
    borderRadius: Theme.radius.xl,
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
    fontSize: Type.caption,
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
