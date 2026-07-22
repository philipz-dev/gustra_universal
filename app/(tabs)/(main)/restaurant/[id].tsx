import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReviewCard } from '@/components/feed/ReviewCard';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { ReviewOrigin } from '@/data/types';

function parseOrigin(value: string | undefined): ReviewOrigin | undefined {
  if (value === 'own' || value === 'imported') return value;
  return undefined;
}

export default function RestaurantVisitsScreen() {
  const { id, origin: originParam } = useLocalSearchParams<{
    id: string;
    origin?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getRestaurant, getReviewsForRestaurant } = useReviewsStore();
  const origin = parseOrigin(originParam);
  const restaurant = getRestaurant(id);
  const reviews = getReviewsForRestaurant(id, origin);

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={restaurant?.name ?? 'Visits'}
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
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              restaurantName={restaurant.name}
              city={restaurant.city}
              thumbnailColor={restaurant.thumbnailColor}
              photoUrl={restaurant.photoUrl}
              onPress={() => router.push(`/review/${item.id}`)}
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
});
