import { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterSearchBar } from '@/components/feed/FilterSearchBar';
import { RestaurantFeedCard } from '@/components/feed/RestaurantFeedCard';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseFAB } from '@/components/ui/HouseFAB';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { getFeedSummaries } from '@/data/mockReviews';

export default function ReviewsFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const summaries = useMemo(() => getFeedSummaries(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q),
    );
  }, [query, summaries]);

  return (
    <View style={styles.screen}>
      <FilterSearchBar value={query} onChangeText={setQuery} />
      {filtered.length === 0 ? (
        <HouseEmptyState
          title={query ? 'No matches' : 'No reviews yet'}
          description={
            query
              ? 'Try another restaurant or city name.'
              : 'Start collecting food memories. Your first review will appear here.'
          }
          systemImage="book.closed"
          androidImage="menu_book"
          actionTitle={query ? undefined : 'Add review'}
          onAction={
            query
              ? undefined
              : () => Alert.alert('Add review', 'Coming soon in a later pass.')
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.restaurantId}
          overScrollMode="never"
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                72 + Theme.spacing.floatingTabBarClearance + insets.bottom,
            },
          ]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <RestaurantFeedCard
              summary={item}
              onPress={() => {
                if (item.visitCount <= 1) {
                  router.push(`/review/${item.reviewIds[0]}`);
                } else {
                  router.push(`/restaurant/${item.restaurantId}`);
                }
              }}
            />
          )}
        />
      )}
      <HouseFAB
        style={{
          bottom:
            Theme.spacing.fabBottom +
            Theme.spacing.floatingTabBarClearance +
            insets.bottom,
        }}
        onPress={() => Alert.alert('Add review', 'Coming soon in a later pass.')}
      />

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
    paddingTop: Theme.spacing.listRowVertical,
  },
  sep: {
    height: Theme.spacing.listRowVertical * 2,
  },
});
