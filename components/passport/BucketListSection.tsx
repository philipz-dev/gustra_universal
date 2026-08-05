import { useCallback, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { PassportSection } from '@/components/passport/PassportSection';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, captionTextStyle, bodyTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useReviewsStore } from '@/context/ReviewsStore';
import { resolveReviewOrigin, type Restaurant } from '@/data/types';
import { requestSwipeDelete } from '@/services/swipeDelete';
import { Haptics } from '@/services/haptics';

type BucketListSectionProps = {
  restaurants: Restaurant[];
  onOpenRestaurant: (restaurant: Restaurant) => void;
};

/**
 * "My Gustra" bucket list — restaurants the user wants to visit, shown above
 * the Time Travel banner. Swipe-to-delete removes the bookmark (iOS confirm,
 * Android Undo snackbar).
 */
export function BucketListSection({
  restaurants,
  onOpenRestaurant,
}: BucketListSectionProps) {
  const { t } = useAppTranslation();
  const { setRestaurantBucket, reviews } = useReviewsStore();

  /** Restaurants that already have an own (possibly draft) review. */
  const reviewedRestaurantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const review of reviews) {
      if (resolveReviewOrigin(review) !== 'own') continue;
      ids.add(review.restaurantId);
    }
    return ids;
  }, [reviews]);

  const handleRemove = useCallback(
    (restaurant: Restaurant) => {
      requestSwipeDelete({
        title: t('bucketList.removeTitle'),
        message: t('bucketList.deleteConfirm', { name: restaurant.name }),
        undoMessage: t('bucketList.deleteRemoved'),
        onCommit: () => {
          void setRestaurantBucket(restaurant.id, false);
        },
      });
    },
    [setRestaurantBucket, t],
  );

  if (restaurants.length === 0) {
    return (
      <PassportSection
        title={t('bucketList.title')}
        kicker={t('bucketList.kicker')}>
        <View style={styles.empty}>
          <SymbolView
            name={{
              ios: 'bookmark',
              android: 'bookmark_border',
              web: 'bookmark_border',
            }}
            tintColor="rgba(35, 32, 26, 0.35)"
            size={22}
          />
          <Text style={styles.emptyText}>{t('bucketList.emptyBody')}</Text>
        </View>
      </PassportSection>
    );
  }

  return (
    <PassportSection
      title={t('bucketList.title')}
      kicker={t('bucketList.kicker')}>
      {restaurants.map((restaurant) => (
        <View key={restaurant.id} style={styles.rowWrap}>
          <FeedSwipeDelete
            id={`bucket-${restaurant.id}`}
            onDelete={() => handleRemove(restaurant)}
            cornerRadius={Theme.radius.lg}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={restaurant.name}
              accessibilityHint={t('passport.timeTravelSubtitle')}
              onPress={() => {
                Haptics.selectionChanged();
                onOpenRestaurant(restaurant);
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}>
              <View style={styles.icon}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="bookmark.fill"
                    tintColor={GustraColors.gold}
                    size={20}
                  />
                ) : (
                  <MaterialIcons
                    name="bookmark"
                    size={20}
                    color={GustraColors.gold}
                  />
                )}
              </View>
              <View style={styles.copy}>
                <SerifText size={16} weight="semibold" style={styles.name}>
                  {restaurant.name}
                </SerifText>
                <Text style={styles.subtitle}>
                  {[restaurant.city, restaurant.country]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(', ') || t('common.none')}
                </Text>
              </View>
              {reviewedRestaurantIds.has(restaurant.id) ? (
                <View style={styles.hasReviewBadge}>
                  {Platform.OS === 'ios' ? (
                    <SymbolView
                      name="checkmark"
                      tintColor={GustraColors.forestGreen}
                      size={14}
                    />
                  ) : (
                    <MaterialIcons
                      name="check"
                      size={16}
                      color={GustraColors.forestGreen}
                    />
                  )}
                </View>
              ) : null}
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="chevron.right"
                  tintColor="rgba(35, 32, 26, 0.35)"
                  size={16}
                />
              ) : (
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color="rgba(35, 32, 26, 0.35)"
                />
              )}
            </Pressable>
          </FeedSwipeDelete>
        </View>
      ))}
    </PassportSection>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    borderRadius: Theme.radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: Theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowPressed: {
    opacity: 0.85,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(36, 78, 57, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: GustraColors.ink,
  },
  subtitle: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  hasReviewBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
  },
  emptyText: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(35, 32, 26, 0.55)',
  },
});
