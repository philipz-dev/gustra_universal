import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';
import { SymbolView } from 'expo-symbols';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { RestaurantThumb } from '@/components/feed/RestaurantThumb';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import {
  bodyTextStyle,
  captionTextStyle,
  listPressedStyle,
  Surface,
  Theme,
  Type,
} from '@/constants/Theme';
import { useDemoLabelSettings } from '@/context/DemoLabelSettings';
import type { RestaurantVisitSummary } from '@/data/types';
import { isDemoRestaurantId } from '@/data/mockReviews';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';

type RestaurantFeedCardProps = {
  summary: RestaurantVisitSummary;
  onPress: () => void;
  /** When set, trailing swipe shows Delete (Swift feed swipeActions). */
  onDelete?: () => void;
  onFavoriteToggle?: (favorite: boolean) => void;
  /**
   * When set (e.g. sort by criterion), stars and score use this value
   * instead of overall average — Swift `RestaurantFeedCardView.scoreOverride`.
   */
  scoreOverride?: number | null;
  /** Title of the criterion used for sorting (e.g. "Drinks"), shown as label. */
  scoreOverrideCriterionTitle?: string | null;
  /** True when the sort criterion has no rating for this restaurant. */
  scoreMissing?: boolean;
  shareSelecting?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
};

export function RestaurantFeedCard({
  summary,
  onPress,
  onDelete,
  onFavoriteToggle,
  scoreOverride,
  scoreOverrideCriterionTitle,
  scoreMissing = false,
  shareSelecting = false,
  selected = false,
  onSelectToggle,
}: RestaurantFeedCardProps) {
  const { t } = useAppTranslation();
  const { showDemoLabel } = useDemoLabelSettings();
  /** M3 state-layer wash on Android (paper Card has no ripple of its own). */
  const [androidCardPressed, setAndroidCardPressed] = useState(false);
  const isDraft = Boolean(summary.isDraft);
  const isDemo = isDemoRestaurantId(summary.restaurantId);
  // When the sort criterion is missing, do not fall back to the overall
  // average — the card must look "not rated on this criterion".
  const displayScore =
    !scoreMissing && typeof scoreOverride === 'number'
      ? scoreOverride
      : summary.ownScore ?? summary.averageScore;
  // Friend score as context below the own main score (only when merged).
  const friendScore =
    summary.friendScore && summary.friendVisitCount ? summary.friendScore : null;

  const handlePress = () => {
    Haptics.light();
    if (shareSelecting) {
      onSelectToggle?.();
    } else {
      onPress();
    }
  };

  const cardBody = (
    <>
      <RestaurantThumb uri={summary.photoUrl} />

      <View style={styles.main}>
        <SerifText size={17} weight="semibold" style={styles.name} numberOfLines={2}>
          {summary.name}
        </SerifText>
        {summary.city ? <Text style={styles.city}>{summary.city}</Text> : null}
        {!isDraft && !scoreMissing && displayScore > 0 ? (
          <FractionalStarRating score={displayScore} size={24} />
        ) : null}
        {!isDraft && scoreMissing ? (
          <Text style={styles.missingCriterion}>
            {scoreOverrideCriterionTitle
              ? t('reviews.noCriterionRatingLabel', {
                  criterion: scoreOverrideCriterionTitle,
                })
              : t('reviews.noRatingLabel')}
          </Text>
        ) : null}
        {!isDraft && !scoreMissing && scoreOverrideCriterionTitle ? (
          <Text style={styles.criterionLabel}>
            {t('reviews.criterionScoreLabel', {
              criterion: scoreOverrideCriterionTitle,
            })}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {summary.visitCount <= 1
            ? summary.lastVisitDate
            : t('reviews.visitCount', {
                count: summary.visitCount,
                date: summary.lastVisitDate,
              })}
        </Text>
        {summary.reviewerName && !isDemo ? (
          <Text style={styles.reviewer}>
            {t('detail.review.reviewedBy', { name: summary.reviewerName })}
          </Text>
        ) : null}
        {friendScore ? (
          <Text style={styles.friendScore}>
            {t('reviews.friendScoreLabel', {
              score: formatScoreOutOfFive(friendScore),
              count: summary.friendVisitCount,
            })}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {isDraft ? (
          <View style={styles.editorialPill}>
            <Text style={styles.editorialPillText}>{t('reviews.draftLabel')}</Text>
          </View>
        ) : (
          <>
            {!scoreMissing && displayScore > 0 ? (
              <SerifText size={20} weight="bold" style={styles.score}>
                {formatScoreOutOfFive(displayScore)}
              </SerifText>
            ) : null}
            {!shareSelecting ? (
              <>
                <FavoriteHeartButton
                  favorite={summary.isFavorite}
                  onToggle={onFavoriteToggle}
                />
                {isDemo && showDemoLabel ? (
                  <View style={styles.demoPill}>
                    <Text style={styles.demoPillText}>{t('reviews.demoLabel')}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </View>
    </>
  );

  // Android: M3 Elevated Card (react-native-paper) — tonal surface, elevation
  // 1→2 state animation on press, and a subtle ink state-layer wash since the
  // paper Card's inner Pressable has no ripple. iOS keeps the HIG pressable.
  // (No a11y props on the paper Card: they'd land on the outer Surface and
  // cause a TalkBack double-focus; the inner Pressable reads the card content.)
  const card =
    Platform.OS === 'android' ? (
      <PaperCard
        mode="elevated"
        elevation={1}
        onPress={handlePress}
        onPressIn={() => setAndroidCardPressed(true)}
        onPressOut={() => setAndroidCardPressed(false)}
        style={styles.card}
        contentStyle={styles.cardRow}>
        {androidCardPressed ? (
          <View pointerEvents="none" style={styles.androidStateLayer} />
        ) : null}
        {cardBody}
      </PaperCard>
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isDraft
            ? `${summary.name}, ${t('reviews.draftLabel')}`
            : undefined
        }
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          styles.cardRow,
          pressed ? listPressedStyle : null,
        ]}>
        {cardBody}
      </Pressable>
    );

  if (shareSelecting) {
    return (
      <View style={styles.shareRow}>
        <Pressable
          style={styles.checkboxContainer}
          onPress={onSelectToggle}
          hitSlop={8}>
          <SymbolView
            name={{
              ios: selected ? 'checkmark.circle.fill' : 'circle',
              android: selected ? 'check_circle' : 'radio_button_unchecked',
              web: selected ? 'check_circle' : 'radio_button_unchecked',
            }}
            tintColor={selected ? GustraColors.forestGreen : 'rgba(35, 32, 26, 0.35)'}
            size={24}
          />
        </Pressable>
        <View style={styles.cardWrapper}>
          {card}
        </View>
      </View>
    );
  }

  if (!onDelete) return card;

  return (
    <FeedSwipeDelete
      id={summary.restaurantId}
      onDelete={onDelete}
      cornerRadius={Theme.radius.xl}>
      {card}
    </FeedSwipeDelete>
  );
}

const styles = StyleSheet.create({
  card: {
    // Paper Card (Android) owns surface/elevation/borderRadius here; the row
    // layout + padding live on Card.contentStyle (see cardRow below).
    borderRadius: Theme.radius.xl,
    ...(Platform.OS === 'ios'
      ? {
          backgroundColor: Theme.list.cardBackground,
          // Avoid iOS blanking: overflow+radius without elevation hides Text.
          overflow: 'hidden' as const,
          ...Surface.raised,
        }
      : {
          overflow: 'visible' as const,
        }),
  },
  /** Row layout — on Android it lives on Card.contentStyle (inner container). */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Theme.spacing.cardPadding,
    minHeight: Theme.size.hitTarget + Theme.spacing.cardPadding,
  },
  /** M3 state layer on Android — subtle ink wash while the card is pressed. */
  androidStateLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(35, 32, 26, 0.05)',
    borderRadius: Theme.radius.xl,
    zIndex: 1,
  },
  main: {
    flex: 1,
    gap: 4,
    minHeight: Theme.size.hitTarget,
    justifyContent: 'center',
  },
  name: {
    color: GustraColors.ink,
  },
  city: {
    ...bodyTextStyle,
    fontSize: Type.bodySmall,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  meta: {
    ...captionTextStyle,
    fontSize: Type.label,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  criterionLabel: {
    ...captionTextStyle,
    fontSize: Type.label,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  missingCriterion: {
    ...captionTextStyle,
    fontSize: Type.label,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.4)',
    fontStyle: 'italic',
  },
  reviewer: {
    ...captionTextStyle,
    fontSize: Type.label,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  friendScore: {
    ...captionTextStyle,
    fontSize: Type.caption,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: Theme.size.hitTarget,
  },
  score: {
    color: GustraColors.forestGreen,
  },
  editorialPill: {
    backgroundColor: 'rgba(199, 71, 66, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(199, 71, 66, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-end',
  },
  editorialPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(199, 71, 66, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  demoPill: {
    backgroundColor: 'rgba(217, 162, 39, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 162, 39, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-end',
  },
  demoPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(176, 121, 18, 0.95)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  draftBadge: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '700',
    color: GustraColors.gold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  checkboxContainer: {
    paddingVertical: 12,
    paddingRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    flex: 1,
  },
});
