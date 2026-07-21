import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ReviewCard } from '@/components/feed/ReviewCard';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { getRestaurant, getReviewsForRestaurant } from '@/data/mockReviews';

export default function RestaurantVisitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const restaurant = getRestaurant(id);
  const reviews = getReviewsForRestaurant(id);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: restaurant?.name ?? 'Visits',
        }}
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
          contentContainerStyle={styles.list}
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
    paddingVertical: Theme.spacing.listRowVertical + 8,
  },
  sep: {
    height: Theme.spacing.listRowVertical * 2,
  },
});
