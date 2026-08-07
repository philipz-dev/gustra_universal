import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissOpenSwipeable } from '@/components/feed/openSwipeable';
import {
  VisitTimelineCard,
  type VisitTimelineEntry,
} from '@/components/timeline/VisitTimelineCard';
import { VisitTimeline } from '@/components/timeline/VisitTimeline';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseFAB } from '@/components/ui/HouseFAB';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { TabBarBottomFade } from '@/components/ui/TabBarBottomFade';
import { GustraColors } from '@/constants/Colors';
import { captionTextStyle, bodyTextStyle, Theme } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { Review, ReviewOrigin } from '@/data/types';
import {
  formatScoreOutOfFive,
  RatingValue,
} from '@/services/reviews/ratings';
import { isReviewDraft } from '@/services/reviews/draftReview';
import { Haptics } from '@/services/haptics';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { requestSwipeDelete } from '@/services/swipeDelete';

function parseOrigin(value: string | undefined): ReviewOrigin | undefined {
  if (value === 'own' || value === 'imported') return value;
  return undefined;
}

function displayLocation(name: string, city: string, country: string): string {
  const parts = [name.trim(), city.trim(), country.trim()].filter(Boolean);
  return parts.join(', ');
}

function firstPhotoUrl(photoUrls: string[] | undefined): string {
  if (!photoUrls?.length) return '';
  for (const raw of photoUrls) {
    const uri = raw?.trim();
    if (uri) return uri;
  }
  return '';
}

/**
 * Restaurant visits in the Time Travel look — one large cinematic card per
 * visit (own cover photo or house-green fallback tile), a timeline rail with
 * gold nodes, and the floating star badge bottom-right. The "Add new review"
 * control is a collapsing extended FAB pinned at the Reviews-feed position.
 *
 * When rendered from the My Gustra stack the pathname starts with
 * `/passport/restaurant`, so review taps stay inside the passport stack and
 * Back returns to My Gustra instead of the Reviews feed.
 */
export default function RestaurantVisitsScreen() {
  const { t } = useAppTranslation();
  const { id, origin: originParam } = useLocalSearchParams<{
    id: string;
    origin?: string;
  }>();
  const router = useRouter();
  const pathname = usePathname();
  const inPassportStack = pathname.startsWith('/passport');
  const insets = useSafeAreaInsets();
  const { getRestaurant, getReviewsForRestaurant, deleteReview } =
    useReviewsStore();
  const origin = parseOrigin(originParam);
  const restaurant = getRestaurant(id);
  const reviews = getReviewsForRestaurant(id, origin);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleReviews = useMemo(
    () => reviews.filter((r) => !pendingDeleteIds.has(r.id)),
    [reviews, pendingDeleteIds],
  );

  const entries = useMemo<VisitTimelineEntry[]>(
    () =>
      visibleReviews.map((review) => ({
        reviewId: review.id,
        restaurantId: review.restaurantId,
        restaurantTitle: restaurant
          ? displayLocation(restaurant.name, restaurant.city, restaurant.country)
          : '—',
        date: review.date,
        score: review.overallScore,
        photoUrl: firstPhotoUrl(review.photoUrls),
        thumbnailColor: restaurant?.thumbnailColor || '#3D6B52',
      })),
    [restaurant, visibleReviews],
  );

  const openAddReview = useCallback(() => {
    Haptics.selectionChanged();
    router.push({
      pathname: '/review-form',
      params: { restaurantId: id, from: 'restaurant' },
    });
  }, [id, router]);

  // FAB sits at the standard clearance above the tab bar; content must always
  // stop *above* the FAB so the plus button never covers the last card.
  const fabBottom =
    Theme.spacing.floatingTabBarClearance + insets.bottom + Theme.spacing.fabClearance;
  const bottomPad = fabBottom + Theme.size.fab + 16;

  const averageScore = useMemo(() => {
    const scores = reviews
      .filter((review) => !isReviewDraft(review))
      .map((review) => {
        const rated = review.criteria
          .filter(
            (c) =>
              c.rating !== undefined &&
              RatingValue.isStarRating(c.rating),
          )
          .map((c) => RatingValue.starValue(c.rating));
        if (rated.length === 0) return review.overallScore;
        return rated.reduce((a, b) => a + b, 0) / rated.length;
      })
      .filter((score) => score > 0);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [reviews]);

  // B: per-source groups. When no explicit `origin` is passed (friend filter
  // active), visits are grouped by "Jij" / friends so each group shows its own
  // average — the user's own score stays the prominent headline.
  const sourceGroups = useMemo(() => {
    const byOrigin = new Map<ReviewOrigin, Review[]>();
    for (const review of visibleReviews) {
      const o = resolveReviewOrigin(review);
      byOrigin.set(o, [...(byOrigin.get(o) ?? []), review]);
    }
    const order: ReviewOrigin[] = ['own', 'imported'];
    return order
      .map((o) => {
        const group = byOrigin.get(o) ?? [];
        if (group.length === 0) return null;
        const scores = group
          .filter((review) => !isReviewDraft(review))
          .map((review) => {
            const rated = review.criteria
              .filter(
                (c) =>
                  c.rating !== undefined &&
                  RatingValue.isStarRating(c.rating),
              )
              .map((c) => RatingValue.starValue(c.rating));
            if (rated.length === 0) return review.overallScore;
            return rated.reduce((a, b) => a + b, 0) / rated.length;
          })
          .filter((score) => score > 0);
        const avg =
          scores.length === 0
            ? 0
            : scores.reduce((a, b) => a + b, 0) / scores.length;
        return { origin: o, reviews: group, average: avg };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [visibleReviews]);

  const showSourceGroups = origin === undefined && sourceGroups.length > 1;

  const confirmDeleteVisit = useCallback(
    (review: Review) => {
      const reviewId = review.id;
      requestSwipeDelete({
        title: t('alerts.deleteVisit.title'),
        message: t('alerts.deleteVisit.body'),
        undoMessage: t('alerts.deleteVisit.undoMessage'),
        onHide: () => {
          setPendingDeleteIds((prev) => new Set(prev).add(reviewId));
        },
        onRestore: () => {
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(reviewId);
            return next;
          });
        },
        onCommit: () => {
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(reviewId);
            return next;
          });
          void (async () => {
            const remainingInSource = reviews.filter((r) => r.id !== reviewId);
            await deleteReview(reviewId);
            if (remainingInSource.length === 0) {
              if (router.canGoBack()) router.back();
              else if (inPassportStack) router.replace('/passport');
              else router.replace('/(tabs)/(main)');
              return;
            }
            if (remainingInSource.length === 1) {
              router.replace(
                inPassportStack
                  ? `/passport/review/${remainingInSource[0]!.id}`
                  : `/review/${remainingInSource[0]!.id}`,
              );
            }
          })();
        },
      });
    },
    [deleteReview, inPassportStack, reviews, router, t],
  );

  const openReview = useCallback(
    (review: Review) => {
      if (isReviewDraft(review)) {
        router.push({
          pathname: '/review-form',
          params: { reviewId: review.id, from: 'restaurant' },
        });
        return;
      }
      router.push(
        inPassportStack
          ? `/passport/review/${review.id}`
          : `/review/${review.id}`,
      );
    },
    [inPassportStack, router],
  );

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('detail.review.title')}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => router.back()}
      />
      {reviews.length === 0 || !restaurant ? (
        <HouseEmptyState
          title={t('detail.restaurant.noVisits')}
          description={t('detail.restaurant.noReviews')}
          systemImage="fork.knife"
          androidImage="restaurant"
        />
      ) : (
        <View style={styles.body} collapsable={false}>
          {/* ——— Summary header (fixed — does not scroll) ——— */}
          <View style={styles.headerBlock}>
            <View style={styles.summaryCard}>
              <SerifText size={20} weight="semibold" style={styles.location}>
                {displayLocation(
                  restaurant.name,
                  restaurant.city,
                  restaurant.country,
                )}
              </SerifText>
              {showSourceGroups ? (
                <>
                  {sourceGroups.map((group) => {
                    const isOwn = group.origin === 'own';
                    const label = isOwn
                      ? t('detail.restaurant.myVisits')
                      : t('detail.restaurant.friendsVisits');
                    return (
                      <View key={group.origin} style={styles.sourceRow}>
                        <Text style={styles.sourceLabel}>{label}</Text>
                        <View style={styles.sourceAvgRow}>
                          {group.average > 0 ? (
                            <>
                              <FractionalStarRating
                                score={group.average}
                                size={isOwn ? 18 : 15}
                              />
                              <SerifText
                                size={isOwn ? 17 : 14}
                                weight={isOwn ? 'semibold' : 'regular'}
                                style={[
                                  styles.avgText,
                                  !isOwn && styles.sourceAvgMuted,
                                ]}>
                                {formatScoreOutOfFive(group.average)}
                              </SerifText>
                            </>
                          ) : (
                            <Text style={styles.sourceAvgMuted}>
                              {t('reviews.notRated')}
                            </Text>
                          )}
                          <Text style={styles.sourceCount}>
                            {group.reviews.length}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {reviews.length > 1 ? (
                    <Text style={styles.visitCount}>
                      {t('detail.restaurant.visitCount', {
                        count: reviews.length,
                      })}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  {averageScore > 0 ? (
                    <View style={styles.avgRow}>
                      <FractionalStarRating score={averageScore} size={22} />
                      <SerifText
                        size={17}
                        weight="semibold"
                        style={styles.avgText}>
                        {formatScoreOutOfFive(averageScore)}
                      </SerifText>
                    </View>
                  ) : null}
                  {reviews.length > 1 ? (
                    <Text style={styles.visitCount}>
                      {t('detail.restaurant.visitCount', {
                        count: reviews.length,
                      })}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* ——— Visit timeline (scrolling; identical to Time Travel) ——— */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.timelineContent, { paddingBottom: bottomPad }]}
            overScrollMode="never"
            onScrollBeginDrag={dismissOpenSwipeable}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}>
            {showSourceGroups ? (
              sourceGroups.map((group) => (
                <View key={group.origin} style={styles.groupBlock}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>
                      {group.origin === 'own'
                        ? t('detail.restaurant.myVisits')
                        : t('detail.restaurant.friendsVisits')}
                    </Text>
                    {group.average > 0 ? (
                      <Text style={styles.groupAvg}>
                        {group.origin === 'own'
                          ? t('detail.restaurant.myAverage')
                          : t('detail.restaurant.friendsAverage')}
                        {' · '}
                        {formatScoreOutOfFive(group.average)}
                      </Text>
                    ) : null}
                  </View>
                  <VisitTimeline
                    entries={entries.filter((e) =>
                      group.reviews.some((r) => r.id === e.reviewId),
                    )}
                    showCounts={false}
                    renderCard={(entry) => {
                      const review = group.reviews.find(
                        (r) => r.id === entry.reviewId,
                      );
                      if (!review) return null;
                      const deletable =
                        resolveReviewOrigin(review) === 'own';
                      return (
                        <VisitTimelineCard
                          key={entry.reviewId}
                          entry={entry}
                          onPress={() => openReview(review)}
                          onDelete={
                            deletable
                              ? () => confirmDeleteVisit(review)
                              : undefined
                          }
                          hideRestaurantTitle
                        />
                      );
                    }}
                  />
                </View>
              ))
            ) : (
              <VisitTimeline
                entries={entries}
                showCounts={false}
                renderCard={(entry) => {
                  const review = visibleReviews.find(
                    (r) => r.id === entry.reviewId,
                  );
                  if (!review) return null;
                  const deletable = resolveReviewOrigin(review) === 'own';
                  return (
                    <VisitTimelineCard
                      key={entry.reviewId}
                      entry={entry}
                      onPress={() => openReview(review)}
                      onDelete={
                        deletable
                          ? () => confirmDeleteVisit(review)
                          : undefined
                      }
                      hideRestaurantTitle
                    />
                  );
                }}
              />
            )}
          </ScrollView>

          <TabBarBottomFade />
          <HouseFAB
            collapsable={false}
            style={{ bottom: fabBottom }}
            onPress={openAddReview}
          />
        </View>
      )}
    </View>
  );
}

function resolveReviewOrigin(review: Review): ReviewOrigin {
  return review.origin ?? 'own';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  body: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 14,
    gap: 22,
  },
  headerBlock: {
    gap: 14,
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: GustraColors.cream,
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
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceLabel: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.65)',
  },
  sourceAvgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceAvgMuted: {
    ...bodyTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  sourceCount: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  groupBlock: {
    gap: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  groupTitle: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  groupAvg: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.5)',
  },
});
