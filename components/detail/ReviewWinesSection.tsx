import { StyleSheet, Text, View } from 'react-native';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { WineIdentityLink } from '@/components/wine/WineIdentityLink';
import { GustraColors } from '@/constants/Colors';
import { ReviewDetailPresentation } from '@/constants/ReviewDetailPresentation';
import { captionTextStyle, Theme } from '@/constants/Theme';
import { WineRowPresentation } from '@/constants/WineRowPresentation';
import type { WineLabelFiche } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type ReviewWinesSectionProps = {
  wines: WineLabelFiche[];
  onOpenWineFiche: (index: number) => void;
  onDeleteWine?: (index: number) => void;
};

function rowKey(wine: WineLabelFiche, index: number): string {
  return `${wine.nameAndEstate}-${wine.labelPhotoUri}-${index}`;
}

/**
 * “Gedronken wijnen” — bubble panel on streamlined detail, or nested under Wijnen.
 */
export function ReviewWinesSection({
  wines,
  onOpenWineFiche,
  onDeleteWine,
}: ReviewWinesSectionProps) {
  const { t } = useAppTranslation();
  const streamlined = ReviewDetailPresentation.isStreamlinedEnabled;
  const richWines = WineRowPresentation.isRichDetailEnabled;

  if (wines.length === 0) return null;

  const list = (
    <View
      style={[
        richWines ? styles.winesListRich : styles.winesList,
        streamlined && styles.winesListStreamlined,
      ]}>
      {wines.map((wine, index) => {
        const isLast = index === wines.length - 1;
        const link = (
          <WineIdentityLink
            name={wine.nameAndEstate}
            rating={wine.userRating}
            wine={wine}
            isLast={isLast}
            onPress={() => onOpenWineFiche(index)}
          />
        );
        if (!onDeleteWine) {
          return <View key={rowKey(wine, index)}>{link}</View>;
        }
        return (
          <FeedSwipeDelete
            key={rowKey(wine, index)}
            id={`review-wine-${index}-${wine.labelPhotoUri || wine.nameAndEstate}`}
            onDelete={() => onDeleteWine(index)}
            cornerRadius={
              streamlined
                ? 0
                : richWines
                  ? Theme.radius.xl
                  : Theme.radius.lg
            }>
            {link}
          </FeedSwipeDelete>
        );
      })}
    </View>
  );

  if (streamlined) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelHeading}>
          {t('detail.review.winesDrunk', { count: wines.length })}
        </Text>
        {list}
      </View>
    );
  }
  return (
    <View
      style={[styles.winesBlock, richWines && styles.winesBlockRich]}>
      <Text
        style={[styles.winesHeading, richWines && styles.winesHeadingRich]}>
        {t('detail.review.winesDrunk', { count: wines.length })}
      </Text>
      {list}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(236, 227, 207, 0.5)',
    borderRadius: Theme.radius.xl,
    paddingTop: 14,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  panelHeading: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(36, 78, 57, 0.65)',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  winesBlock: {
    marginTop: 10,
    gap: 8,
  },
  winesBlockRich: {
    marginTop: 12,
    gap: 10,
  },
  winesList: {
    gap: 8,
  },
  winesListRich: {
    gap: 10,
  },
  winesListStreamlined: {
    gap: 0,
  },
  winesHeading: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '700',
    color: GustraColors.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  winesHeadingRich: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'none',
    color: 'rgba(36, 78, 57, 0.75)',
  },
});
