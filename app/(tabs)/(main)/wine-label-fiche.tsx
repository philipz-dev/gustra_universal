import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WineLabelFicheView } from '@/components/wine/WineLabelFicheView';
import { WineUserRatingFields } from '@/components/wine/WineUserRatingFields';
import { houseAlert, houseSaveChangesAlert } from '@/components/ui/HouseAlert';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraColors } from '@/constants/Colors';
import { Theme, captionTextStyle } from '@/constants/Theme';
import {
  WINE_FICHE_CUTOUT_HEADER_OVERLAP,
  WineFichePresentation,
} from '@/constants/WineFichePresentation';
import type { WineLabelFiche } from '@/data/types';
import { useReviewsStore } from '@/context/ReviewsStore';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';
import { RatingValue } from '@/services/reviews/ratings';
import { setPendingWineLabelResult } from '@/services/wine/pendingWineLabelResult';
import {
  clearPreviewWineLabelFiche,
  getPreviewWineLabelEditIndex,
  getPreviewWineLabelFiche,
} from '@/services/wine/previewWineLabelFiche';
import {
  hasWineLabelMatch,
  wineLabelsForReview,
} from '@/services/wine/wineLabelTypes';

/**
 * Wine identity card — read-only from review detail, or editable (stars + note)
 * from the review form (same options as scan result).
 */
export default function WineLabelFicheScreen() {
  const { t } = useAppTranslation();
  const { reviewId, preview, wineIndex, edit } =
    useLocalSearchParams<{
      reviewId?: string;
      preview?: string;
      wineIndex?: string;
      edit?: string;
      /** Optional; kept for older deep links — navigation after delete uses reviewId. */
      restaurantId?: string;
    }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { getReview } = useReviewsStore();
  const isPreview = preview === '1' || preview === 'true';
  const isEdit = edit === '1' || edit === 'true';
  const review = reviewId ? getReview(reviewId) : undefined;
  const index = Math.max(0, Number.parseInt(wineIndex ?? '0', 10) || 0);
  const wines = wineLabelsForReview(review);
  const initialFiche = isPreview
    ? getPreviewWineLabelFiche()
    : (wines[index] ?? wines[0] ?? null);
  const formEditIndex = isPreview ? getPreviewWineLabelEditIndex() : null;
  const canDeleteWine =
    isEdit && hasWineLabelMatch(initialFiche) && typeof formEditIndex === 'number';
  const leaveReviewId =
    (typeof reviewId === 'string' ? reviewId.trim() : '') || review?.id || '';

  const [fiche] = useState<WineLabelFiche | null>(initialFiche);
  const [rating, setRating] = useState(() =>
    RatingValue.isStarRating(initialFiche?.userRating ?? 0)
      ? (initialFiche!.userRating as number)
      : RatingValue.unrated,
  );
  const [note, setNote] = useState(
    () => initialFiche?.userComment?.trim() ?? '',
  );
  const allowLeaveRef = useRef(false);

  const baselineKey = useMemo(
    () =>
      JSON.stringify({
        r: initialFiche?.userRating ?? 0,
        c: initialFiche?.userComment?.trim() ?? '',
      }),
    [initialFiche?.userComment, initialFiche?.userRating],
  );

  const isDirty = useMemo(() => {
    if (!isEdit || !hasWineLabelMatch(fiche)) return false;
    const next = JSON.stringify({
      r: RatingValue.isStarRating(rating) ? rating : 0,
      c: note.trim(),
    });
    return next !== baselineKey;
  }, [baselineKey, fiche, isEdit, note, rating]);

  const canConfirm =
    isEdit && hasWineLabelMatch(fiche) && RatingValue.isStarRating(rating);

  useEffect(() => {
    return () => {
      if (isPreview) clearPreviewWineLabelFiche();
    };
  }, [isPreview]);

  const confirmEdit = useCallback(() => {
    if (!fiche || !RatingValue.isStarRating(rating)) return;
    const next: WineLabelFiche = {
      ...fiche,
      userRating: rating,
      userComment: note.trim() || undefined,
    };
    setPendingWineLabelResult({
      drinksComment: note.trim(),
      drinksRating: rating,
      ocrText: next.nameAndEstate.trim(),
      croppedUri: null,
      wineLabel: next,
      replaceIndex:
        typeof formEditIndex === 'number' ? formEditIndex : undefined,
    });
    allowLeaveRef.current = true;
    router.back();
  }, [fiche, formEditIndex, note, rating, router]);

  const confirmDeleteWine = useCallback(() => {
    if (typeof formEditIndex !== 'number' || !fiche) return;
    const name = fiche.nameAndEstate.trim() || t('wineScan.fiche.title');
    Haptics.warning();
    houseAlert(t('wineScan.deleteWineTitle'), t('wineScan.deleteWineBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setPendingWineLabelResult({
            drinksComment: '',
            ocrText: '',
            wineLabel: null,
            removeIndex: formEditIndex,
            leaveToReviewId: leaveReviewId || undefined,
          });
          allowLeaveRef.current = true;
          router.back();
        },
      },
    ]);
  }, [fiche, formEditIndex, leaveReviewId, router, t]);

  const promptDiscard = useCallback(
    (onLeave: () => void) => {
      Haptics.warning();
      houseSaveChangesAlert({
        title: t('wineScan.discardUnsaved.title'),
        onYes: () => {
          if (canConfirm) {
            confirmEdit();
            return;
          }
          // Still leave — user chose Ja; nothing valid to persist.
          allowLeaveRef.current = true;
          onLeave();
        },
        onNo: () => {
          allowLeaveRef.current = true;
          onLeave();
        },
      });
    },
    [canConfirm, confirmEdit, t],
  );

  useEffect(() => {
    if (!isEdit) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !isDirty) return;
      event.preventDefault();
      promptDiscard(() => {
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [isDirty, isEdit, navigation, promptDiscard]);

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;
  const cutout = WineFichePresentation.isCutoutHeroEnabled;
  const cutoutOverlap = cutout ? WINE_FICHE_CUTOUT_HEADER_OVERLAP : 0;
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  return (
    <View style={styles.screen}>
      <View style={styles.headerLayer}>
        <HouseNavHeader
          title={t('wineScan.fiche.title')}
          showBack
          onBack={() => {
            if (isEdit && isDirty) {
              promptDiscard(() => router.back());
              return;
            }
            router.back();
          }}
          right={
            isEdit && hasWineLabelMatch(fiche) ? (
              <HouseToolbarIconButton
                iosName="checkmark"
                androidName="check"
                accessibilityLabel={t('wineScan.confirmA11y')}
                disabled={!canConfirm}
                onPress={confirmEdit}
              />
            ) : null
          }
        />
      </View>
      {!hasWineLabelMatch(fiche) ? (
        <HouseEmptyState
          title={t('wineScan.noMatchTitle')}
          description={t('wineScan.noMatchBody')}
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={cutout ? { marginTop: -cutoutOverlap } : undefined}
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: bottomPad, paddingTop: cutoutOverlap },
          ]}
          keyboardShouldPersistTaps="handled"
          overScrollMode="never"
          showsVerticalScrollIndicator={!cutout}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}>
          <WineLabelFicheView
            fiche={fiche!}
            showUserRating={!isEdit}
            scrollRef={scrollRef}
            scrollYRef={scrollYRef}
            scrollBottomInset={bottomPad}
            ratingSlot={
              isEdit ? (
                <>
                  <WineUserRatingFields
                    rating={rating}
                    onRatingChange={setRating}
                    note={note}
                    onNoteChange={setNote}
                  />
                  {!canConfirm ? (
                    <Text style={styles.ratingHint}>
                      {t('wineScan.ratingRequired')}
                    </Text>
                  ) : null}
                </>
              ) : undefined
            }
          />
          {isEdit && canDeleteWine ? (
            <View style={styles.editPad}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('wineScan.deleteWineA11y')}
                onPress={confirmDeleteWine}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && styles.pressed,
                ]}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="trash"
                    size={34}
                    tintColor="rgba(199, 71, 66, 0.9)"
                    weight="medium"
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={34}
                    color="rgba(199, 71, 66, 0.9)"
                  />
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  headerLayer: {
    zIndex: 10,
    elevation: 10,
  },
  pad: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 10,
  },
  editPad: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },
  ratingHint: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
    marginTop: 8,
  },
  deleteBtn: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
