import { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommentChip } from '@/components/detail/CommentChip';
import { CriterionSection } from '@/components/detail/CriterionSection';
import { HeroPhotoPager } from '@/components/detail/HeroPhotoPager';
import { LocationBlock } from '@/components/detail/LocationBlock';
import { ProfilePhotoViewer } from '@/components/detail/ProfilePhotoViewer';
import { RestaurantMapViewer } from '@/components/detail/RestaurantMapViewer';
import { ReviewPhotoViewer } from '@/components/detail/ReviewPhotoViewer';
import type { ShareDestination } from '@/components/detail/ShareReviewChooser';
import { PreparingRecommendationOverlay } from '@/components/share/PreparingRecommendationOverlay';
import {
  ShareFlowSheet,
  type ShareFlowStep,
} from '@/components/share/ShareFlowSheet';
import {
  HousePrimaryButton,
  HousePrimaryButtonRow,
} from '@/components/ui/HousePrimaryButton';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import { formatReviewDate } from '@/data/mockReviews';
import { presentDirectionsOptions } from '@/services/directions/DirectionsLauncher';
import { shareReviewAsEmail } from '@/services/share/ReviewEmailShare';
import { shareReviewsPackage } from '@/services/share/ReviewShareService';

function afterSheetDismiss(work: () => void): void {
  setTimeout(work, Platform.OS === 'ios' ? 360 : 60);
}

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getRestaurant, getReview, setRestaurantFavorite, restaurants } =
    useReviewsStore();
  const { hasName, name, photoUri, getBackupSnapshot, updateName } =
    useReviewerProfile();
  const review = getReview(id);
  const restaurant = review ? getRestaurant(review.restaurantId) : undefined;

  const { enabledCriteria } = useCriteriaSettings();
  const enabledIds = new Set(enabledCriteria.map((c) => c.id));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showReviewerPhoto, setShowReviewerPhoto] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [shareStep, setShareStep] = useState<ShareFlowStep | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareDestination | null>(
    null,
  );
  const [pendingSharedBy, setPendingSharedBy] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [preparingEmail, setPreparingEmail] = useState(false);
  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  const reviewerPhotoUri =
    review?.reviewedByPhotoUrl?.trim() ||
    (review?.origin === 'own' && review.reviewedBy.trim() ? photoUri : null) ||
    null;

  const canShare = Boolean(review && !sharing);

  const closeShareFlow = useCallback(() => {
    setShareStep(null);
    setPendingShare(null);
    setPendingSharedBy(null);
  }, []);

  const runShare = useCallback(
    async (
      destination: ShareDestination,
      sharedByOverride?: string,
      personalMessage?: string,
    ) => {
      if (!review || !restaurant) return;
      setSharing(true);
      if (destination === 'email') setPreparingEmail(true);
      try {
        const profile = await getBackupSnapshot();
        const sharedBy = (sharedByOverride ?? profile.name).trim();
        if (!sharedBy) {
          throw new Error('Your name is included when you share reviews.');
        }
        if (destination === 'gustraPackage') {
          await shareReviewsPackage({
            reviews: [review],
            restaurants,
            sharedBy,
            sharedByPhotoBase64: profile.photoBase64,
          });
        } else {
          await shareReviewAsEmail({
            review,
            restaurant,
            sharedBy,
            enabledCriteria,
            personalMessage,
            onSnapshotReady: () => setPreparingEmail(false),
          });
        }
      } catch (error) {
        houseAlert(
          'Error',
          error instanceof Error
            ? error.message
            : 'Could not share this review.',
        );
      } finally {
        setPreparingEmail(false);
        setSharing(false);
        setPendingShare(null);
        setPendingSharedBy(null);
      }
    },
    [
      enabledCriteria,
      getBackupSnapshot,
      restaurants,
      restaurant,
      review,
    ],
  );

  const onSelectDestination = useCallback(
    (destination: ShareDestination) => {
      setPendingShare(destination);
      if (!hasName) {
        setShareStep('name');
        return;
      }
      if (destination === 'email') {
        setPendingSharedBy(null);
        setShareStep('message');
        return;
      }
      setShareStep(null);
      afterSheetDismiss(() => {
        void runShare(destination);
      });
    },
    [hasName, runShare],
  );

  const onNameContinue = useCallback(
    (sharedBy: string) => {
      updateName(sharedBy);
      setPendingSharedBy(sharedBy);
      const destination = pendingShare;
      if (!destination) {
        closeShareFlow();
        return;
      }
      if (destination === 'email') {
        // Stay in the same Modal — swap to message step (no flicker).
        setShareStep('message');
        return;
      }
      setShareStep(null);
      afterSheetDismiss(() => {
        void runShare(destination, sharedBy);
      });
    },
    [closeShareFlow, pendingShare, runShare, updateName],
  );

  const onMessageContinue = useCallback(
    (message: string) => {
      const sharedBy = pendingSharedBy ?? undefined;
      // Show preparing under the sheet so the review never flashes through.
      setPreparingEmail(true);
      setShareStep(null);
      setPendingShare(null);
      afterSheetDismiss(() => {
        void runShare('email', sharedBy, message);
      });
    },
    [pendingSharedBy, runShare],
  );

  const addressLine = restaurant
    ? [restaurant.address, restaurant.city, restaurant.country]
        .filter(Boolean)
        .join(', ')
    : '';

  const header = (
    <HouseNavHeader
      title="Review"
      titleSize={Theme.navigation.secondaryTitleSize}
      showBack
      onBack={() => router.back()}
      right={
        canShare ? (
          <HouseToolbarIconButton
            iosName="square.and.arrow.up"
            androidName="share"
            accessibilityLabel="Share"
            disabled={sharing}
            onPress={() => setShareStep('chooser')}
          />
        ) : null
      }
    />
  );

  if (!review || !restaurant) {
    return (
      <View style={styles.screen}>
        {header}
        <HouseEmptyState
          title="Review not found"
          description="This memory is not in the mock data set."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        overScrollMode="never"
        nestedScrollEnabled>
        {review.photoUrls.length > 0 ? (
          <HeroPhotoPager
            uris={review.photoUrls}
            index={photoIndex}
            onIndexChange={setPhotoIndex}
            onPressPhoto={(index) => {
              setPhotoIndex(index);
              setShowPhotoViewer(true);
            }}
          />
        ) : null}

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <SerifText size={20} weight="bold" style={styles.restaurantName}>
                {restaurant.name}
              </SerifText>
              <FavoriteHeartButton
                favorite={restaurant.isFavorite}
                onToggle={(favorite) => {
                  void setRestaurantFavorite(restaurant.id, favorite);
                }}
              />
            </View>
            <Text style={styles.date}>{formatReviewDate(review.date)}</Text>
            <View style={styles.divider} />
          </View>

          {review.criteria
            .filter(
              (c) => c.rating >= 1 && c.rating <= 10 && enabledIds.has(c.id),
            )
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
              void presentDirectionsOptions({
                name: restaurant.name,
                addressLine,
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              })
            }
            onOpenMap={() => setShowMap(true)}
          />

          <View style={styles.actions}>
            <View style={styles.divider} />
            <HousePrimaryButtonRow>
              <HousePrimaryButton
                flex
                title="New visit"
                onPress={() =>
                  router.push({
                    pathname: '/review-form',
                    params: { restaurantId: restaurant.id },
                  })
                }
              />
              <HousePrimaryButton
                flex
                title="Edit"
                onPress={() =>
                  router.push({
                    pathname: '/review-form',
                    params: { reviewId: review.id },
                  })
                }
              />
            </HousePrimaryButtonRow>
          </View>

          {review.reviewedBy ? (
            <View style={styles.reviewedBy}>
              {reviewerPhotoUri ? (
                <Pressable
                  onPress={() => setShowReviewerPhoto(true)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Profile photo">
                  <Image
                    source={{ uri: reviewerPhotoUri }}
                    style={styles.avatarImage}
                  />
                </Pressable>
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {review.reviewedBy.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.reviewedByLabel}>
                Reviewed by {review.reviewedBy}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ReviewPhotoViewer
        visible={showPhotoViewer}
        uris={review.photoUrls}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
        onClose={() => setShowPhotoViewer(false)}
      />

      {reviewerPhotoUri ? (
        <ProfilePhotoViewer
          visible={showReviewerPhoto}
          uri={reviewerPhotoUri}
          onClose={() => setShowReviewerPhoto(false)}
        />
      ) : null}

      <RestaurantMapViewer
        visible={showMap}
        restaurant={restaurant}
        onClose={() => setShowMap(false)}
      />

      <ShareFlowSheet
        visible={shareStep !== null}
        step={shareStep ?? 'chooser'}
        initialName={name}
        onClose={closeShareFlow}
        onSelectDestination={onSelectDestination}
        onNameContinue={onNameContinue}
        onMessageContinue={onMessageContinue}
      />

      <PreparingRecommendationOverlay visible={preparingEmail} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  scroll: {},
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
  avatarImage: {
    width: Theme.size.avatar,
    height: Theme.size.avatar,
    borderRadius: Theme.size.avatar / 2,
    backgroundColor: GustraColors.bubble,
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
