import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterSearchBar } from '@/components/feed/FilterSearchBar';
import { dismissOpenSwipeable } from '@/components/feed/openSwipeable';
import { RestaurantFeedCard } from '@/components/feed/RestaurantFeedCard';
import { ReviewSourcePicker } from '@/components/feed/ReviewSourcePicker';
import { ShareReviewerNameModal } from '@/components/feed/ShareReviewerNameModal';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseFAB } from '@/components/ui/HouseFAB';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { Review, ReviewOrigin } from '@/data/types';
import { shareReviewsPackage } from '@/services/share/ReviewShareService';

export default function ReviewsFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [reviewSource, setReviewSource] = useState<ReviewOrigin>('own');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const {
    getFeedSummaries,
    getReview,
    restaurants,
    hasFriendReviews,
    ready,
    deleteRestaurantFromFeed,
  } = useReviewsStore();
  const { hasName, updateName, getBackupSnapshot } = useReviewerProfile();

  useEffect(() => {
    if (!hasFriendReviews && reviewSource !== 'own') {
      setReviewSource('own');
    }
  }, [hasFriendReviews, reviewSource]);

  const summaries = useMemo(
    () => (ready ? getFeedSummaries(reviewSource) : []),
    [getFeedSummaries, ready, reviewSource],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q),
    );
  }, [query, summaries]);

  /** Visible feed rows → underlying reviews (Swift `filteredReviews`). */
  const reviewsToShare = useMemo(() => {
    const list: Review[] = [];
    for (const summary of filtered) {
      for (const id of summary.reviewIds) {
        const review = getReview(id);
        if (review) list.push(review);
      }
    }
    return list;
  }, [filtered, getReview]);

  const isFriends = reviewSource === 'imported';
  const canShare = !isFriends && reviewsToShare.length > 0 && !sharing;

  const performShare = useCallback(
    async (sharedByOverride?: string) => {
      if (reviewsToShare.length === 0) return;
      setSharing(true);
      try {
        const profile = await getBackupSnapshot();
        const sharedBy = (sharedByOverride ?? profile.name).trim();
        if (!sharedBy) {
          throw new Error('Your name is included when you share reviews.');
        }
        await shareReviewsPackage({
          reviews: reviewsToShare,
          restaurants,
          sharedBy,
          sharedByPhotoBase64: profile.photoBase64,
        });
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error
            ? error.message
            : 'Could not prepare the shared reviews file.',
        );
      } finally {
        setSharing(false);
      }
    },
    [getBackupSnapshot, restaurants, reviewsToShare],
  );

  const openShare = useCallback(() => {
    if (!canShare) return;
    if (!hasName) {
      setNameModalVisible(true);
      return;
    }
    void performShare();
  }, [canShare, hasName, performShare]);

  const emptyTitle = query
    ? 'No matches'
    : isFriends
      ? 'No Friend Reviews'
      : 'No reviews yet';
  const emptyDescription = query
    ? 'Try another restaurant or city name.'
    : isFriends
      ? "Import shared reviews to see friends' reviews here."
      : 'Start collecting food memories. Your first review will appear here.';

  return (
    <View style={styles.screen}>
      <ReviewsHeader
        showShare={!isFriends}
        canShare={canShare}
        sharing={sharing}
        onShare={openShare}
      />
      {hasFriendReviews ? (
        <ReviewSourcePicker value={reviewSource} onChange={setReviewSource} />
      ) : null}
      <FilterSearchBar value={query} onChangeText={setQuery} />
      {filtered.length === 0 ? (
        <HouseEmptyState
          title={emptyTitle}
          description={emptyDescription}
          systemImage={isFriends ? 'person.2' : 'book.closed'}
          androidImage={isFriends ? 'group' : 'menu_book'}
          actionTitle={query || isFriends ? undefined : 'Add review'}
          onAction={
            query || isFriends
              ? undefined
              : () => Alert.alert('Add review', 'Coming soon in a later pass.')
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.restaurantId}
          overScrollMode="never"
          onScrollBeginDrag={dismissOpenSwipeable}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                (isFriends ? 24 : 72) +
                Theme.spacing.floatingTabBarClearance +
                insets.bottom,
            },
          ]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <RestaurantFeedCard
              summary={item}
              onDelete={() => {
                Alert.alert(
                  'Delete restaurant?',
                  `“${item.name}” and its reviews will be permanently deleted. This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        void deleteRestaurantFromFeed(item);
                      },
                    },
                  ],
                );
              }}
              onPress={() => {
                if (item.visitCount <= 1) {
                  router.push(`/review/${item.reviewIds[0]}`);
                } else {
                  router.push({
                    pathname: '/restaurant/[id]',
                    params: { id: item.restaurantId, origin: reviewSource },
                  });
                }
              }}
            />
          )}
        />
      )}
      {!isFriends ? (
        <HouseFAB
          style={{
            bottom:
              Theme.spacing.fabBottom +
              Theme.spacing.floatingTabBarClearance +
              insets.bottom,
          }}
          onPress={() =>
            Alert.alert('Add review', 'Coming soon in a later pass.')
          }
        />
      ) : null}
      <ShareReviewerNameModal
        visible={nameModalVisible}
        onCancel={() => setNameModalVisible(false)}
        onContinue={(name) => {
          updateName(name);
          setNameModalVisible(false);
          // Wait for the sheet to dismiss before presenting the share UI.
          setTimeout(() => {
            void performShare(name);
          }, 350);
        }}
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
