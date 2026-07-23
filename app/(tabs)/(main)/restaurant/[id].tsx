import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissOpenSwipeable } from '@/components/feed/openSwipeable';
import { VisitRowCard } from '@/components/feed/VisitRowCard';
import { houseAlert } from '@/components/ui/HouseAlert';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { Review, ReviewOrigin } from '@/data/types';
import { RatingValue } from '@/services/reviews/ratings';

function parseOrigin(value: string | undefined): ReviewOrigin | undefined {
  if (value === 'own' || value === 'imported') return value;
  return undefined;
}

function displayLocation(name: string, city: string, country: string): string {
  const parts = [name.trim(), city.trim(), country.trim()].filter(Boolean);
  return parts.join(', ');
}

/**
 * Chronological visits for one restaurant (Swift `RestaurantVisitsView`).
 */
export default function RestaurantVisitsScreen() {
  const { id, origin: originParam } = useLocalSearchParams<{
    id: string;
    origin?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabledCriteria } = useCriteriaSettings();
  const { getRestaurant, getReviewsForRestaurant, deleteReview } =
    useReviewsStore();
  const origin = parseOrigin(originParam);
  const restaurant = getRestaurant(id);
  const reviews = getReviewsForRestaurant(id, origin);

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  const averageScore = useMemo(() => {
    const enabledIds = new Set(enabledCriteria.map((c) => c.id));
    const scores = reviews
      .map((review) => {
        const rated = review.criteria
          .filter(
            (c) => enabledIds.has(c.id) && RatingValue.isStarRating(c.rating),
          )
          .map((c) => RatingValue.starValue(c.rating));
        if (rated.length === 0) return review.overallScore;
        return rated.reduce((a, b) => a + b, 0) / rated.length;
      })
      .filter((score) => score > 0);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [enabledCriteria, reviews]);

  const confirmDeleteVisit = useCallback(
    (review: Review) => {
      houseAlert(
        'Delete Visit?',
        'Deleting this visit will change the overall score for this restaurant.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                const remainingInSource = reviews.filter(
                  (r) => r.id !== review.id,
                );
                await deleteReview(review.id);
                if (remainingInSource.length === 0) {
                  if (router.canGoBack()) router.back();
                  else router.replace('/(tabs)/(main)');
                  return;
                }
                if (remainingInSource.length === 1) {
                  router.replace(`/review/${remainingInSource[0]!.id}`);
                }
              })();
            },
          },
        ],
      );
    },
    [deleteReview, reviews, router],
  );

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={restaurant?.name ?? 'Restaurant'}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => router.back()}
      />
      {reviews.length === 0 || !restaurant ? (
        <HouseEmptyState
          title="No visits"
          description="This restaurant has no reviews yet."
          systemImage="fork.knife"
          androidImage="restaurant"
        />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          overScrollMode="never"
          onScrollBeginDrag={dismissOpenSwipeable}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <View style={styles.summaryCard}>
                <SerifText size={20} weight="semibold" style={styles.location}>
                  {displayLocation(
                    restaurant.name,
                    restaurant.city,
                    restaurant.country,
                  )}
                </SerifText>
                {averageScore > 0 ? (
                  <View style={styles.avgRow}>
                    <FractionalStarRating score={averageScore} size={22} />
                    <SerifText size={17} weight="semibold" style={styles.avgText}>
                      {averageScore.toFixed(1)}/5
                    </SerifText>
                  </View>
                ) : null}
                <Text style={styles.visitCount}>
                  {reviews.length === 1
                    ? '1 visit'
                    : `${reviews.length} visits`}
                </Text>
              </View>
              <Text style={styles.sectionLabel}>Visits</Text>
            </View>
          }
          renderItem={({ item }) => (
            <VisitRowCard
              review={item}
              onPress={() => router.push(`/review/${item.id}`)}
              onDelete={() => confirmDeleteVisit(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: Theme.spacing.listRowVertical + 8,
  },
  sep: {
    height: Theme.spacing.listRowVertical * 2,
  },
  headerBlock: {
    marginBottom: 12,
    gap: 14,
  },
  summaryCard: {
    padding: Theme.spacing.cardPadding,
    borderRadius: Theme.radius.xl,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    gap: 8,
  },
  location: {
    color: GustraColors.forestGreen,
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avgText: {
    color: GustraColors.forestGreen,
  },
  visitCount: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.65)',
  },
  sectionLabel: {
    ...bodyTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
});
