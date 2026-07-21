import { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Stack, useLocalSearchParams } from 'expo-router';

import { CommentChip } from '@/components/detail/CommentChip';
import { CriterionSection } from '@/components/detail/CriterionSection';
import { LocationBlock } from '@/components/detail/LocationBlock';
import {
  HousePrimaryButton,
  HousePrimaryButtonRow,
} from '@/components/ui/HousePrimaryButton';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import {
  formatReviewDate,
  getRestaurant,
  getReview,
} from '@/data/mockReviews';


const HERO_H = Theme.size.heroHeight;

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const review = getReview(id);
  const restaurant = review ? getRestaurant(review.restaurantId) : undefined;
  const { enabledCriteria } = useCriteriaSettings();
  const enabledIds = new Set(enabledCriteria.map((c) => c.id));
  const [photoIndex, setPhotoIndex] = useState(0);
  const pageWidth = useRef(Dimensions.get('window').width).current;


  if (!review || !restaurant) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Review' }} />
        <HouseEmptyState
          title="Review not found"
          description="This memory is not in the mock data set."
        />
      </View>
    );
  }

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPhotoIndex(Math.round(x / pageWidth));
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Review' }} />
      <ScrollView contentContainerStyle={styles.scroll} overScrollMode="never">
        {review.photoUrls.length > 0 ? (
          <View style={styles.heroBlock}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              overScrollMode="never"
              onScroll={onHeroScroll}
              scrollEventThrottle={16}
              style={styles.heroScroll}>
              {review.photoUrls.map((uri, index) => (
                <View
                  key={`${uri}-${index}`}
                  style={[styles.heroPage, { width: pageWidth }]}>
                  <Image source={{ uri }} style={styles.heroImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
            {review.photoUrls.length > 1 ? (
              <Text style={styles.pageIndicator}>
                {photoIndex + 1} / {review.photoUrls.length}
              </Text>
            ) : null}
          </View>
        ) : null}


        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <SerifText size={20} weight="bold" style={styles.restaurantName}>
                {restaurant.name}
              </SerifText>
              <FavoriteHeartButton initialFavorite={restaurant.isFavorite} />
            </View>
            <Text style={styles.date}>{formatReviewDate(review.date)}</Text>
            <View style={styles.divider} />
          </View>

          {review.criteria
            .filter((c) => c.rating > 0 && enabledIds.has(c.id))
            .map((criterion) => (
              <CriterionSection key={criterion.id} criterion={criterion} />
            ))}


          {review.generalComment ? (
            <View style={styles.section}>
              <SerifText size={20} weight="bold" style={styles.sectionTitle}>
                General comments
              </SerifText>
              <CommentChip text={review.generalComment} />
            </View>
          ) : null}

          <LocationBlock
            restaurant={restaurant}
            onDirections={() =>
              Alert.alert('Get directions', 'Maps integration coming later.')
            }
          />

          <View style={styles.actions}>
            <View style={styles.divider} />
            <HousePrimaryButtonRow>
              <HousePrimaryButton
                flex
                title="New visit"
                onPress={() => Alert.alert('New visit', 'Coming soon.')}
              />
              <HousePrimaryButton
                flex
                title="Edit"
                onPress={() => Alert.alert('Edit review', 'Coming soon.')}
              />
            </HousePrimaryButtonRow>
          </View>

          {review.reviewedBy ? (
            <View style={styles.reviewedBy}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {review.reviewedBy.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.reviewedByLabel}>
                Reviewed by {review.reviewedBy}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  scroll: {
    paddingBottom: 40,
  },
  heroBlock: {
    paddingTop: 12,
    gap: 10,
    backgroundColor: GustraColors.cream,
  },
  heroScroll: {
    height: HERO_H,
  },
  heroPage: {
    height: HERO_H,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  heroImage: {
    flex: 1,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(35, 32, 26, 0.14)',
    backgroundColor: GustraColors.bubble,
  },

  pageIndicator: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(35, 32, 26, 0.55)',
    fontVariant: ['tabular-nums'],
  },
  content: {
    padding: Theme.spacing.detailContent,
    gap: Theme.spacing.detailSection,
  },
  header: {
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  restaurantName: {
    flex: 1,
    color: GustraColors.forestGreen,
  },
  date: {
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(35, 32, 26, 0.15)',
    marginTop: 8,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: GustraColors.ink,
  },
  actions: {
    gap: 16,
  },
  reviewedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: Theme.size.avatar,
    height: Theme.size.avatar,
    borderRadius: Theme.size.avatar / 2,
    backgroundColor: 'rgba(36, 78, 57, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: GustraColors.forestGreen,
    fontWeight: '700',
    fontSize: 15,
  },
  reviewedByLabel: {
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.6)',
  },
});
