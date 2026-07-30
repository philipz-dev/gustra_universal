import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ScrollView,
} from 'react-native';

import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { SerifText } from '@/components/ui/SerifText';
import { StaticStarRating } from '@/components/ui/StarRating';
import { WineTasteProfileSection } from '@/components/wine/WineTasteProfileSection';
import { GustraColors } from '@/constants/Colors';
import { WineFichePresentation } from '@/constants/WineFichePresentation';
import {
  SERIF_FONT_REGULAR,
  SERIF_FONT_SEMIBOLD,
  bodyTextStyle,
  captionTextStyle,
  Theme,
} from '@/constants/Theme';
import type { WineLabelFiche } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { relocateLocalPhotoRef } from '@/services/backup/photos';
import {
  formatHalfStarOutOfFive,
  RatingValue,
} from '@/services/reviews/ratings';
import { wineLabelGrapeDisplay } from '@/services/wine/wineGrapeVarieties';
import { resolveWineProfileParts } from '@/services/wine/wineProfileLabel';
import { shouldShowTasteProfile } from '@/services/wine/wineTasteProfile';

type WineLabelFicheViewProps = {
  fiche: WineLabelFiche;
  /** When false, hide stored user stars/notes (editor shows its own fields). */
  showUserRating?: boolean;
  /** Edit/add: “rate this bottle” card — rendered above Type & style. */
  ratingSlot?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scrollYRef?: RefObject<number>;
  scrollBottomInset?: number;
};

type MetaCellProps = {
  label: string;
  value: string;
};

function MetaCell({ label, value }: MetaCellProps) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/**
 * House-styled wine fiche: cutout or card hero, judgment, meta grid.
 * Deferred: Vision pairing tags, edit/share on card.
 * Revert cutout: `WineFichePresentation.isCutoutHeroEnabled = false`.
 */
export function WineLabelFicheView({
  fiche,
  showUserRating = true,
  ratingSlot,
  scrollRef,
  scrollYRef,
  scrollBottomInset,
}: WineLabelFicheViewProps) {
  const { t } = useAppTranslation();
  const cutout = WineFichePresentation.isCutoutHeroEnabled;
  const tasteProfileOn = WineFichePresentation.isTasteProfileEnabled;
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const uri = fiche.labelPhotoUri?.trim()
    ? relocateLocalPhotoRef(fiche.labelPhotoUri)
    : '';
  const alcohol =
    fiche.alcoholPercent != null && Number.isFinite(fiche.alcoholPercent)
      ? `${fiche.alcoholPercent}%`
      : '';
  const profile = resolveWineProfileParts(fiche);
  const profileLabel = t(profile.i18nKey);
  const grapesLabel = wineLabelGrapeDisplay(fiche);
  const showTasteProfile =
    tasteProfileOn && shouldShowTasteProfile(fiche);
  const region = fiche.countryRegion?.trim() ?? '';
  const vintage = fiche.vintage?.trim() ?? '';
  const pairings = fiche.foodPairings?.trim() ?? '';
  const subline = [region, vintage].filter(Boolean).join(' · ');

  const hasStars =
    showUserRating && RatingValue.isStarRating(fiche.userRating ?? 0);
  const hasNote = showUserRating && Boolean(fiche.userComment?.trim());
  const hasJudgment = hasStars || hasNote;

  const metaCells: { label: string; value: string }[] = [];
  metaCells.push({
    label: t('wineScan.fiche.typeStyle'),
    value: profileLabel,
  });
  // When Smaakprofiel is visible, grapes live there (with optional %).
  if (grapesLabel && !showTasteProfile) {
    metaCells.push({ label: t('wineScan.fiche.grapes'), value: grapesLabel });
  }
  if (alcohol) {
    metaCells.push({ label: t('wineScan.fiche.alcohol'), value: alcohol });
  }

  const hasBody =
    metaCells.length > 0 || pairings.length > 0 || showTasteProfile;

  return (
    <View style={styles.wrap}>
      <View style={[styles.heroPad, cutout && styles.heroPadCutout]}>
        {cutout ? <View style={styles.cutoutGlow} pointerEvents="none" /> : null}
        <View style={[styles.photoCard, cutout && styles.photoCardCutout]}>
          {uri ? (
            <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <PhotoPlaceholder iconSize={cutout ? 40 : 48} />
          )}
        </View>
        {cutout ? (
          <View style={styles.cutoutShadow} pointerEvents="none" />
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.identityHead,
          cutout && styles.identityHeadCutout,
          { opacity: fade, transform: [{ translateY: slide }] },
        ]}>
        <SerifText size={28} weight="bold" style={styles.title}>
          {fiche.nameAndEstate}
        </SerifText>
        {subline ? <Text style={styles.subline}>{subline}</Text> : null}

        {hasJudgment ? (
          <View style={styles.judgmentBlock}>
            <Text style={styles.judgmentLabel}>
              {t('wineScan.fiche.myJudgment')}
            </Text>
            {hasStars ? (
              <View style={styles.scoreRow}>
                <StaticStarRating rating={fiche.userRating!} size={18} />
                <Text style={styles.scoreNumber}>
                  {formatHalfStarOutOfFive(fiche.userRating!)}
                </Text>
              </View>
            ) : null}
            {hasNote ? (
              <View style={styles.quoteRow}>
                <View style={styles.quoteAccent} />
                <Text style={styles.userNote}>
                  “{fiche.userComment!.trim()}”
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      {ratingSlot ? (
        <View style={styles.ratingSlot}>{ratingSlot}</View>
      ) : null}

      {hasBody ? (
        <Animated.View
          style={[
            styles.metaBlock,
            { opacity: fade, transform: [{ translateY: slide }] },
          ]}>
          {metaCells.length > 0 ? (
            <View style={styles.metaGrid}>
              {metaCells.map((cell) => (
                <MetaCell
                  key={cell.label}
                  label={cell.label}
                  value={cell.value}
                />
              ))}
            </View>
          ) : null}

          {pairings ? (
            <View
              style={[
                styles.pairingsBlock,
                metaCells.length > 0 && styles.pairingsAfterMeta,
              ]}>
              <Text style={styles.pairingsLabel}>
                {t('wineScan.fiche.foodPairings')}
              </Text>
              <Text style={styles.pairingsValue}>{pairings}</Text>
            </View>
          ) : null}

          {showTasteProfile ? (
            <WineTasteProfileSection
              fiche={fiche}
              scrollRef={scrollRef}
              scrollYRef={scrollYRef}
              scrollBottomInset={scrollBottomInset}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  heroPad: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  heroPadCutout: {
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
    zIndex: 2,
  },
  /** Soft forest wash so the floating label reads against the green nav. */
  cutoutGlow: {
    position: 'absolute',
    top: -8,
    width: '78%',
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(36, 78, 57, 0.14)',
  },
  photoCard: {
    alignSelf: 'stretch',
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: GustraColors.bubble,
    ...Platform.select({
      ios: {
        shadowColor: '#23201A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  photoCardCutout: {
    alignSelf: 'center',
    width: '68%',
    maxWidth: 260,
    aspectRatio: 0.62,
    borderRadius: Theme.radius.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1510',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  cutoutShadow: {
    marginTop: -6,
    width: '52%',
    maxWidth: 200,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(35, 32, 26, 0.14)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  identityHead: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 4,
  },
  identityHeadCutout: {
    paddingTop: 12,
  },
  title: {
    color: GustraColors.ink,
    textAlign: 'center',
    letterSpacing: -0.35,
    lineHeight: 34,
  },
  subline: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
  },
  judgmentBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Theme.radius.xl,
    backgroundColor: GustraColors.bubble,
  },
  judgmentLabel: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(36, 78, 57, 0.75)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreNumber: {
    fontFamily: SERIF_FONT_SEMIBOLD,
    fontSize: 22,
    color: GustraColors.ink,
    letterSpacing: -0.3,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  quoteAccent: {
    width: 2,
    alignSelf: 'stretch',
    minHeight: 28,
    borderRadius: 1,
    backgroundColor: GustraColors.forestGreen,
    opacity: 0.4,
    marginTop: 3,
  },
  userNote: {
    flex: 1,
    fontFamily: SERIF_FONT_REGULAR,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
    color: 'rgba(35, 32, 26, 0.75)',
  },
  ratingSlot: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  metaBlock: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingBottom: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 14,
  },
  metaCell: {
    flexGrow: 1,
    flexBasis: '42%',
    minWidth: 120,
    gap: 4,
  },
  metaLabel: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(36, 78, 57, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaValue: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '500',
    color: GustraColors.ink,
    lineHeight: 22,
  },
  pairingsBlock: {
    gap: 6,
  },
  pairingsAfterMeta: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(35, 32, 26, 0.1)',
  },
  pairingsLabel: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(36, 78, 57, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pairingsValue: {
    fontFamily: SERIF_FONT_REGULAR,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(35, 32, 26, 0.88)',
  },
});
