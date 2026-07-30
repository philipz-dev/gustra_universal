import { useCallback, useMemo, useState } from 'react';
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
import {
  ReviewOptionsSheet,
  type ReviewOptionsAction,
} from '@/components/detail/ReviewOptionsSheet';
import { ReviewWinesSection } from '@/components/detail/ReviewWinesSection';
import type { ShareDestination } from '@/components/detail/ShareReviewChooser';
import { PreparingRecommendationOverlay } from '@/components/share/PreparingRecommendationOverlay';
import {
  ShareFlowSheet,
  type ShareFlowStep,
} from '@/components/share/ShareFlowSheet';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { ReviewDetailPresentation } from '@/constants/ReviewDetailPresentation';
import { SERIF_FONT, Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import { formatReviewDate } from '@/data/mockReviews';
import {
  resolveReviewOrigin,
  resolveReviewerAvatarUri,
  type WineLabelFiche,
} from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { relocateLocalPhotoRef } from '@/services/backup/photos';
import { presentDirectionsOptions } from '@/services/directions/DirectionsLauncher';
import { Haptics } from '@/services/haptics';
import { shareReviewAsEmail } from '@/services/share/ReviewEmailShare';
import { shareReviewsPackage } from '@/services/share/ReviewShareService';
import { requestSwipeDelete } from '@/services/swipeDelete';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';
import {
  hasWineLabelMatch,
  wineLabelsForReview,
} from '@/services/wine/wineLabelTypes';

function wineRowKey(wine: WineLabelFiche): string {
  return `${wine.labelPhotoUri ?? ''}|${wine.nameAndEstate}`;
}

function afterSheetDismiss(work: () => void): void {
  setTimeout(work, Platform.OS === 'ios' ? 360 : 60);
}

export default function ReviewDetailScreen() {
  const { t } = useAppTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    getRestaurant,
    getReview,
    setRestaurantFavorite,
    removeWineFromReview,
    restaurants,
  } = useReviewsStore();
  const { hasName, name, photoUri, getBackupSnapshot, updateName } =
    useReviewerProfile();
  const review = getReview(id);
  const restaurant = review ? getRestaurant(review.restaurantId) : undefined;
  const photoUris =
    review?.photoUrls
      .map((u) => relocateLocalPhotoRef(u.trim()))
      .filter(Boolean) ?? [];
  const isFriendReview = review
    ? resolveReviewOrigin(review) === 'imported'
    : false;

  const { enabledCriteria } = useCriteriaSettings();
  const enabledIds = new Set(enabledCriteria.map((c) => c.id));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showReviewerPhoto, setShowReviewerPhoto] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [shareStep, setShareStep] = useState<ShareFlowStep | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareDestination | null>(
    null,
  );
  const [pendingSharedBy, setPendingSharedBy] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [preparingEmail, setPreparingEmail] = useState(false);
  const [pendingWineKeys, setPendingWineKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  const reviewerPhotoRaw = review
    ? resolveReviewerAvatarUri(review, photoUri)
    : null;
  const reviewerPhotoUri = reviewerPhotoRaw
    ? relocateLocalPhotoRef(reviewerPhotoRaw)
    : null;

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
          throw new Error(t('share.nameSheet.body'));
        }
        if (destination === 'gustraPackage') {
          await shareReviewsPackage({
            reviews: [review],
            restaurants,
            sharedBy,
            sharedById: profile.authorId,
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
          t('common.error'),
          error instanceof Error
            ? error.message
            : t('alerts.share.reviewFailed'),
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
      t,
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

  const onOptionsAction = useCallback(
    (action: ReviewOptionsAction) => {
      if (!review || !restaurant) return;
      setOptionsVisible(false);
      afterSheetDismiss(() => {
        switch (action) {
          case 'recordVisit':
            router.push({
              pathname: '/review-form',
              params: { restaurantId: restaurant.id },
            });
            break;
          case 'edit':
            if (isFriendReview) return;
            router.push({
              pathname: '/review-form',
              params: { reviewId: review.id },
            });
            break;
          case 'shareGustra':
            onSelectDestination('gustraPackage');
            break;
          case 'shareVisual':
            onSelectDestination('email');
            break;
        }
      });
    },
    [isFriendReview, onSelectDestination, restaurant, review, router],
  );

  const addressLine = restaurant
    ? [restaurant.address, restaurant.city, restaurant.country]
        .filter(Boolean)
        .join(', ')
    : '';

  const reviewWines = wineLabelsForReview(review);
  const visibleWines = useMemo(
    () =>
      reviewWines.filter(
        (wine) =>
          hasWineLabelMatch(wine) && !pendingWineKeys.has(wineRowKey(wine)),
      ),
    [reviewWines, pendingWineKeys],
  );
  const polished = ReviewDetailPresentation.isPolishedEnabled;
  const streamlined = ReviewDetailPresentation.isStreamlinedEnabled;

  const openWineFiche = useCallback(
    (wineIndex: number) => {
      const wine = visibleWines[wineIndex];
      if (!wine || !review) return;
      const resolved = reviewWines.findIndex(
        (w) =>
          w.nameAndEstate === wine.nameAndEstate &&
          w.labelPhotoUri === wine.labelPhotoUri,
      );
      if (resolved < 0) return;
      router.push({
        pathname: '/wine-label-fiche',
        params: {
          reviewId: review.id,
          wineIndex: String(resolved),
        },
      });
    },
    [review, reviewWines, router, visibleWines],
  );

  const deleteWine = useCallback(
    (wineIndex: number) => {
      const wine = visibleWines[wineIndex];
      if (!wine || !review || isFriendReview) return;
      const key = wineRowKey(wine);
      const name = wine.nameAndEstate.trim() || t('wineScan.fiche.title');
      requestSwipeDelete({
        title: t('wineScan.deleteWineTitle'),
        message: t('wineScan.deleteWineBody', { name }),
        undoMessage: t('wineScan.deleteWineUndo', { name }),
        onHide: () => {
          setPendingWineKeys((prev) => new Set(prev).add(key));
        },
        onRestore: () => {
          setPendingWineKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        },
        onCommit: () => {
          setPendingWineKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          const latest = wineLabelsForReview(getReview(review.id));
          const idx = latest.findIndex((w) => wineRowKey(w) === key);
          if (idx >= 0) {
            void removeWineFromReview(review.id, idx);
          }
        },
      });
    },
    [
      getReview,
      isFriendReview,
      removeWineFromReview,
      review,
      t,
      visibleWines,
    ],
  );

  const reviewerRow =
    review?.reviewedBy ? (
      <View
        style={[
          styles.reviewedBy,
          polished && styles.reviewedByHeader,
        ]}>
        {reviewerPhotoUri ? (
          <Pressable
            onPress={() => setShowReviewerPhoto(true)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('settings.photoA11y')}>
            <Image
              source={{ uri: reviewerPhotoUri }}
              style={[
                styles.avatarImage,
                polished && styles.avatarImageCompact,
              ]}
            />
          </Pressable>
        ) : (
          <View style={[styles.avatar, polished && styles.avatarCompact]}>
            <Text
              style={[
                styles.avatarLetter,
                polished && styles.avatarLetterCompact,
              ]}>
              {review.reviewedBy.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.reviewedByLabel}>
          {t('detail.review.reviewedBy', { name: review.reviewedBy })}
        </Text>
      </View>
    ) : null;

  const header = (
    <HouseNavHeader
      title={t('detail.review.title')}
      titleSize={Theme.navigation.secondaryTitleSize}
      showBack
      onBack={() => router.back()}
      right={
        review ? (
          <View style={styles.headerActions}>
            <HouseToolbarIconButton
              iosName="ellipsis"
              androidName="more-vert"
              accessibilityLabel={t('detail.options.a11y')}
              disabled={sharing}
              onPress={() => {
                Haptics.selectionChanged();
                setOptionsVisible(true);
              }}
            />
          </View>
        ) : null
      }
    />
  );

  if (!review || !restaurant) {
    return (
      <View style={styles.screen}>
        {header}
        <HouseEmptyState
          title={t("detail.review.notFound")}
          description={t("detail.review.notFoundBody")}
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
        <HeroPhotoPager
          key={photoUris.join('|') || 'empty'}
          uris={photoUris}
          index={
            photoUris.length > 0
              ? Math.min(photoIndex, photoUris.length - 1)
              : 0
          }
          onIndexChange={setPhotoIndex}
          onPressPhoto={(index) => {
            if (photoUris.length === 0) return;
            setPhotoIndex(index);
            setShowPhotoViewer(true);
          }}
        />

        <View
          style={[styles.content, polished && styles.contentPolished]}>
          <View style={[styles.header, polished && styles.headerPolished]}>
            <View style={styles.headerRow}>
              <View style={styles.titleBlock}>
                <SerifText
                  size={polished ? 22 : 20}
                  weight="bold"
                  style={styles.restaurantName}
                  numberOfLines={polished ? 2 : undefined}>
                  {restaurant.name}
                </SerifText>
              </View>
              <FavoriteHeartButton
                favorite={restaurant.isFavorite}
                onToggle={(favorite) => {
                  void setRestaurantFavorite(restaurant.id, favorite);
                }}
              />
            </View>
            {polished && review.overallScore > 0 ? (
              <View style={styles.scoreRow}>
                <FractionalStarRating
                  score={review.overallScore}
                  size={20}
                />
                <SerifText size={22} weight="bold" style={styles.score}>
                  {formatScoreOutOfFive(review.overallScore)}
                </SerifText>
              </View>
            ) : null}
            <Text style={styles.date}>{formatReviewDate(review.date)}</Text>
            {polished ? reviewerRow : <View style={styles.divider} />}
          </View>

          {(() => {
            const scoredCriteria = review.criteria.filter((c) => {
              if (!enabledIds.has(c.id)) return false;
              if (c.rating >= 1 && c.rating <= 10) return true;
              return c.id === 'wines' && reviewWines.length > 0;
            });
            return scoredCriteria.map((criterion) => (
              <CriterionSection
                key={criterion.id}
                criterion={criterion}
                wineLabels={visibleWines}
                onOpenWineFiche={
                  !streamlined &&
                  criterion.id === 'wines' &&
                  visibleWines.length > 0
                    ? openWineFiche
                    : undefined
                }
                onDeleteWine={
                  !streamlined &&
                  criterion.id === 'wines' &&
                  visibleWines.length > 0 &&
                  !isFriendReview
                    ? deleteWine
                    : undefined
                }
              />
            ));
          })()}

          {review.generalComment ? (
            polished ? (
              <View style={styles.quoteBlock}>
                <Text style={styles.quoteMark}>“</Text>
                <Text style={styles.quoteText}>{review.generalComment}</Text>
              </View>
            ) : (
              <View style={styles.section}>
                <SerifText size={20} weight="bold" style={styles.sectionTitle}>
                  {t('detail.review.generalComments')}
                </SerifText>
                <CommentChip text={review.generalComment} />
              </View>
            )
          ) : null}

          {streamlined && visibleWines.length > 0 ? (
            <ReviewWinesSection
              wines={visibleWines}
              onOpenWineFiche={openWineFiche}
              onDeleteWine={isFriendReview ? undefined : deleteWine}
            />
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

          {!polished ? reviewerRow : null}
        </View>
      </ScrollView>

      <ReviewPhotoViewer
        visible={showPhotoViewer && photoUris.length > 0}
        uris={photoUris}
        index={Math.min(photoIndex, Math.max(photoUris.length - 1, 0))}
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

      <ReviewOptionsSheet
        visible={optionsVisible}
        isFriendReview={isFriendReview}
        onClose={() => setOptionsVisible(false)}
        onAction={onOptionsAction}
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
  contentPolished: {
    gap: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    gap: 4,
  },
  headerPolished: {
    gap: 8,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  restaurantName: {
    color: GustraColors.forestGreen,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    // Match FavoriteHeartButton hit padding so `/5` lines up with the heart glyph.
    paddingRight: 2,
  },
  score: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
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
  quoteBlock: {
    gap: 4,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(36, 78, 57, 0.28)',
    paddingVertical: 2,
  },
  quoteMark: {
    fontFamily: SERIF_FONT,
    fontSize: 28,
    lineHeight: 28,
    color: 'rgba(36, 78, 57, 0.35)',
    marginBottom: -8,
  },
  quoteText: {
    fontFamily: SERIF_FONT,
    fontSize: 17,
    lineHeight: 26,
    color: 'rgba(35, 32, 26, 0.82)',
  },
  reviewedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewedByHeader: {
    marginTop: 2,
    gap: 8,
  },
  avatar: {
    width: Theme.size.avatar,
    height: Theme.size.avatar,
    borderRadius: Theme.size.avatar / 2,
    backgroundColor: 'rgba(36, 78, 57, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarImage: {
    width: Theme.size.avatar,
    height: Theme.size.avatar,
    borderRadius: Theme.size.avatar / 2,
    backgroundColor: GustraColors.bubble,
  },
  avatarImageCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarLetter: {
    color: GustraColors.forestGreen,
    fontWeight: '700',
    fontSize: 15,
  },
  avatarLetterCompact: {
    fontSize: 12,
  },
  reviewedByLabel: {
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.6)',
  },
});
