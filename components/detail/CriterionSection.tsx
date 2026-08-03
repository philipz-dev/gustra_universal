import { StyleSheet, Text, View } from 'react-native';

import { CommentChip } from '@/components/detail/CommentChip';
import { ReviewWinesSection } from '@/components/detail/ReviewWinesSection';
import { SerifText } from '@/components/ui/SerifText';
import {
  REVIEW_DETAIL_STAR_SIZE,
  REVIEW_DETAIL_STARS_WIDTH,
  StaticStarRating,
} from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { ReviewDetailPresentation } from '@/constants/ReviewDetailPresentation';
import { bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import type { CriterionRating, WineLabelFiche } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  drinksCommentForDisplay,
  hasWineLabelMatch,
} from '@/services/wine/wineLabelTypes';

type CriterionSectionProps = {
  criterion: CriterionRating;
  /** Structured wine fiches — nested under Wijnen when not detached. */
  wineLabels?: WineLabelFiche[];
  onOpenWineFiche?: (index: number) => void;
  /** Own reviews: swipe-to-delete a wine. */
  onDeleteWine?: (index: number) => void;
  /**
   * When true, never nest wines here (parent renders `ReviewWinesSection`
   * after all scores). Defaults to streamlined layout.
   */
  detachWines?: boolean;
};

export function CriterionSection({
  criterion,
  wineLabels = [],
  onOpenWineFiche,
  onDeleteWine,
  detachWines = ReviewDetailPresentation.isStreamlinedEnabled,
}: CriterionSectionProps) {
  const { t } = useAppTranslation();
  const polished = ReviewDetailPresentation.isPolishedEnabled;
  const streamlined = ReviewDetailPresentation.isStreamlinedEnabled;
  const isWines = criterion.id === 'drinks';
  const isDrinks = criterion.id === 'drinks';
  const wines = isWines ? wineLabels.filter(hasWineLabelMatch) : [];
  const comment = isDrinks
    ? drinksCommentForDisplay(criterion.comment, wineLabels)
    : criterion.comment.trim();
  const showStars = criterion.rating >= 1 && criterion.rating <= 10;
  const showWinesAverageHint =
    isWines && wines.length > 0 && showStars && !streamlined;

  const winesBlock =
    !detachWines && wines.length > 0 && onOpenWineFiche ? (
      <ReviewWinesSection
        wines={wines}
        onOpenWineFiche={onOpenWineFiche}
        onDeleteWine={onDeleteWine}
      />
    ) : null;

  if (polished) {
    return (
      <View
        style={[
          styles.section,
          styles.sectionPolished,
          streamlined && styles.sectionStreamlined,
        ]}>
        <View style={styles.compactRow}>
          <SerifText
            size={streamlined ? 17 : 18}
            weight="bold"
            style={styles.titleCompact}
            numberOfLines={1}
            ellipsizeMode="tail">
            {criterion.title}
          </SerifText>
          {showStars ? (
            <View
              style={[
                styles.starsWrap,
                streamlined && styles.starsWrapStreamlined,
              ]}>
              <StaticStarRating
                rating={criterion.rating}
                size={streamlined ? REVIEW_DETAIL_STAR_SIZE : 18}
                showLabel={!streamlined}
                labelPlacement="inline"
              />
            </View>
          ) : null}
        </View>
        {showWinesAverageHint ? (
          <Text style={styles.avgHint}>
            {t('detail.review.drinksAverage')}
          </Text>
        ) : null}
        {comment ? (
          <Text style={styles.quietComment}>{comment}</Text>
        ) : null}
        {winesBlock}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SerifText size={20} weight="bold" style={styles.title}>
        {criterion.title}
      </SerifText>
      {showStars ? (
        <StaticStarRating rating={criterion.rating} showLabel />
      ) : null}
      {comment ? <CommentChip text={comment} /> : null}
      {winesBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionPolished: {
    gap: 8,
  },
  sectionStreamlined: {
    gap: 6,
  },
  title: {
    color: GustraColors.ink,
  },
  titleCompact: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    color: GustraColors.ink,
    marginRight: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    minHeight: 24,
  },
  starsWrap: {
    flexShrink: 0,
    alignSelf: 'center',
    marginTop: 1,
  },
  starsWrapStreamlined: {
    width: REVIEW_DETAIL_STARS_WIDTH,
    alignItems: 'flex-start',
  },
  avgHint: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.45)',
    marginTop: -2,
  },
  quietComment: {
    ...bodyTextStyle,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(35, 32, 26, 0.72)',
  },
});
