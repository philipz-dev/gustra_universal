import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';

import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { SerifText } from '@/components/ui/SerifText';
import {
  REVIEW_DETAIL_STARS_WIDTH,
  StaticStarRating,
} from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { ReviewDetailPresentation } from '@/constants/ReviewDetailPresentation';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { WineRowPresentation } from '@/constants/WineRowPresentation';
import type { WineLabelFiche } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { relocateLocalPhotoRef } from '@/services/backup/photos';
import { Haptics } from '@/services/haptics';
import {
  formatHalfStarOutOfFive,
  RatingValue,
} from '@/services/reviews/ratings';
import { resolveWineProfileParts } from '@/services/wine/wineProfileLabel';

type WineIdentityLinkProps = {
  name: string;
  onPress: () => void;
  /** Smaller compact row for the review form. */
  compact?: boolean;
  /** Half-star rating 1–10 shown under the name. */
  rating?: number;
  /**
   * Full fiche — when rich detail is on, shows label thumb + meta.
   * Ignored for compact / when `WineRowPresentation.isRichDetailEnabled` is false.
   */
  wine?: WineLabelFiche | null;
  /** Hide bottom separator when last row in a wines panel. */
  isLast?: boolean;
};

function wineMetaParts(
  wine: WineLabelFiche | null | undefined,
  profileLabel: string,
  streamlined: boolean,
): string {
  if (!wine) return '';
  if (streamlined) {
    return [wine.countryRegion?.trim(), wine.vintage?.trim()]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    wine.countryRegion?.trim(),
    wine.vintage?.trim(),
    profileLabel.trim(),
  ]
    .filter(Boolean)
    .join(' · ');
}

function Chevron({ large }: { large?: boolean }) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="chevron.right"
        size={large ? 18 : 14}
        tintColor={GustraColors.forestGreen}
        weight="semibold"
      />
    );
  }
  return (
    <MaterialIcons
      name="chevron-right"
      size={large ? 26 : 22}
      color={GustraColors.forestGreen}
    />
  );
}

/**
 * Clickable wine name → opens the house-styled identity card (fiche).
 * Streamlined detail: row inside the wines panel; score aligns with criterion stars.
 */
export function WineIdentityLink({
  name,
  onPress,
  compact = false,
  rating,
  wine,
  isLast = false,
}: WineIdentityLinkProps) {
  const { t } = useAppTranslation();
  const label = name.trim() || t('wineScan.fiche.title');
  const showStars =
    rating != null && RatingValue.isStarRating(rating);
  const rich =
    !compact && WineRowPresentation.isRichDetailEnabled && Boolean(wine);
  const streamlined =
    !compact && ReviewDetailPresentation.isStreamlinedEnabled;
  const inlineList = rich && streamlined;

  const profileLabel = wine ? t(resolveWineProfileParts(wine).i18nKey) : '';
  const meta = rich ? wineMetaParts(wine, profileLabel, streamlined) : '';
  const scoreText =
    inlineList && rating != null ? formatHalfStarOutOfFive(rating) : '';
  const photoUri =
    rich && !inlineList && wine?.labelPhotoUri?.trim()
      ? relocateLocalPhotoRef(wine.labelPhotoUri)
      : '';
  const showStarRow = showStars && !(rich && streamlined);
  const showThumb = rich && !inlineList;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('wineScan.fiche.openA11y')}
      onPress={() => {
        Haptics.selectionChanged();
        onPress();
      }}
      style={({ pressed }) => [
        rich && !inlineList ? styles.richCard : null,
        !rich ? styles.card : null,
        compact && styles.cardCompact,
        inlineList && styles.inlineRow,
        inlineList && !isLast && styles.inlineRowBorder,
        pressed && styles.pressed,
      ]}>
      {rich ? (
        <View style={styles.richRow}>
          {showThumb ? (
            <View
              style={[
                styles.thumb,
                streamlined && styles.thumbStreamlined,
              ]}>
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <PhotoPlaceholder iconSize={streamlined ? 20 : 22} />
              )}
            </View>
          ) : null}
          <View style={styles.richBody}>
            <View style={styles.nameRow}>
              <SerifText
                size={streamlined ? 17 : 18}
                weight="semibold"
                style={styles.richName}
                numberOfLines={1}
                ellipsizeMode="tail">
                {label}
              </SerifText>
              {inlineList ? (
                <View style={styles.starsColumn}>
                  <View style={styles.chevronSlot}>
                    <Chevron large />
                  </View>
                </View>
              ) : (
                <Chevron />
              )}
            </View>
            {meta || scoreText ? (
              <View style={styles.metaRow}>
                {meta ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {meta}
                  </Text>
                ) : (
                  <View style={styles.metaSpacer} />
                )}
                {scoreText ? (
                  <View style={styles.starsColumn}>
                    <SerifText size={15} weight="semibold" style={styles.metaScore}>
                      {scoreText}
                    </SerifText>
                  </View>
                ) : null}
              </View>
            ) : null}
            {showStarRow ? (
              <StaticStarRating rating={rating} size={15} />
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, compact && styles.nameCompact]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {label}
            </Text>
            <Chevron />
          </View>
          {showStars ? (
            <StaticStarRating rating={rating} size={compact ? 14 : 16} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const THUMB = 64;
const THUMB_STREAMLINED = 56;

const styles = StyleSheet.create({
  card: {
    gap: 6,
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardCompact: {
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    gap: 4,
  },
  richCard: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xl,
    padding: 10,
  },
  inlineRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  inlineRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.08)',
  },
  richRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
  },
  thumbStreamlined: {
    width: THUMB_STREAMLINED,
    height: THUMB_STREAMLINED,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  richBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.ink,
    minWidth: 0,
  },
  nameCompact: {
    fontSize: 16,
  },
  richName: {
    flex: 1,
    minWidth: 0,
    color: GustraColors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    ...bodyTextStyle,
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  metaSpacer: {
    flex: 1,
  },
  /** Same trailing column as criterion stars — score starts at first star. */
  starsColumn: {
    width: REVIEW_DETAIL_STARS_WIDTH,
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chevronSlot: {
    width: '100%',
    alignItems: 'flex-end',
  },
  metaScore: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.72,
  },
});
