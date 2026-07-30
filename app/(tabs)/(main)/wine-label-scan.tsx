import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabelCropCanvas } from '@/components/wine/LabelCropCanvas';
import { WineLabelFicheView } from '@/components/wine/WineLabelFicheView';
import { WineUserRatingFields } from '@/components/wine/WineUserRatingFields';
import { houseAlert, houseSaveChangesAlert } from '@/components/ui/HouseAlert';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { PhotoSourceChooserBody } from '@/components/ui/PhotoSourceChooser';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import type { WineLabelFiche } from '@/data/types';
import { useLanguageSettings } from '@/context/LanguageSettings';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { GeminiAPIConfig } from '@/constants/GeminiAPIConfig';
import { Haptics } from '@/services/haptics';
import { safeOpenSettings } from '@/services/linking/safeLinking';
import {
  renderCroppedLabel,
  type CropTransform,
  type ImageSize,
  type LabelCropViewport,
} from '@/services/photos/labelCrop';
import { RatingValue } from '@/services/reviews/ratings';
import { saveReviewPhoto } from '@/services/reviews/photoStorage';
import { identifyWineLabel } from '@/services/wine/identifyWineLabel';
import { setPendingWineLabelResult } from '@/services/wine/pendingWineLabelResult';
import {
  hasSeenWineVisionUploadNotice,
  markWineVisionUploadNoticeSeen,
} from '@/services/wine/wineVisionConsent';

type Step = 'pick' | 'crop' | 'result';

/**
 * Drinks → Scan wine label: photo → crop → Gemini Vision → fiche → confirm ✓.
 */
export default function WineLabelScanScreen() {
  const { t } = useAppTranslation();
  const { language } = useLanguageSettings();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('pick');
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [labelPhotoUri, setLabelPhotoUri] = useState<string | null>(null);
  const [fiche, setFiche] = useState<WineLabelFiche | null>(null);
  const [busy, setBusy] = useState(false);
  const [drinksRating, setDrinksRating] = useState(RatingValue.unrated);
  const [drinksNote, setDrinksNote] = useState('');

  const allowLeaveRef = useRef(false);
  const imageSizeRef = useRef<ImageSize | null>(null);
  const transformRef = useRef<CropTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const viewportRef = useRef<LabelCropViewport>({ width: 280, height: 400 });

  const hasUnsavedWork = useMemo(() => {
    if (fiche) return true;
    if (step === 'crop' && draftUri) return true;
    if (step === 'result' && (labelPhotoUri || draftUri)) return true;
    if (RatingValue.isStarRating(drinksRating) || drinksNote.trim()) return true;
    return false;
  }, [draftUri, drinksNote, drinksRating, fiche, labelPhotoUri, step]);

  const openSettingsAlert = useCallback(
    (message: string) => {
      houseAlert(t('alerts.permission.needed'), message, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.openSettings'),
          onPress: () => void safeOpenSettings(),
        },
      ]);
    },
    [t],
  );

  const setDraft = useCallback((uri: string) => {
    imageSizeRef.current = null;
    transformRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
    setDraftUri(uri);
    setLabelPhotoUri(null);
    setFiche(null);
    setDrinksRating(RatingValue.unrated);
    setDrinksNote('');
    setStep('crop');
  }, []);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(t('alerts.permission.camera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setDraft(result.assets[0].uri);
  }, [openSettingsAlert, setDraft, t]);

  const importPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(t('alerts.permission.photos'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setDraft(result.assets[0].uri);
  }, [openSettingsAlert, setDraft, t]);

  const ensureUploadNotice = useCallback(async (): Promise<boolean> => {
    if (await hasSeenWineVisionUploadNotice()) return true;
    return new Promise((resolve) => {
      houseAlert(
        t('wineScan.uploadNoticeTitle'),
        t('wineScan.uploadNoticeBody'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: t('wineScan.uploadNoticeContinue'),
            onPress: () => {
              void markWineVisionUploadNoticeSeen().then(() => resolve(true));
            },
          },
        ],
      );
    });
  }, [t]);

  const runCropAndAnalyze = useCallback(async () => {
    if (!draftUri || !imageSizeRef.current) return;
    if (!GeminiAPIConfig.isConfigured) {
      houseAlert(t('common.error'), t('wineScan.missingKeyBody'));
      return;
    }
    const ok = await ensureUploadNotice();
    if (!ok) return;

    setBusy(true);
    try {
      const cropped = await renderCroppedLabel({
        uri: draftUri,
        image: imageSizeRef.current,
        viewport: viewportRef.current,
        transform: transformRef.current,
      });
      const savedCrop = await saveReviewPhoto(cropped);

      // One Vision call — human-readable fields in active app language.
      const result = await identifyWineLabel(draftUri, { language });
      if (!result.fiche) {
        setLabelPhotoUri(savedCrop);
        setFiche(null);
        setStep('result');
        houseAlert(t('wineScan.noMatchTitle'), t('wineScan.noMatchBody'));
        return;
      }

      const labelSaved = await saveReviewPhoto(result.optimizedUri);
      const nextFiche: WineLabelFiche = {
        ...result.fiche,
        labelPhotoUri: labelSaved,
      };
      setLabelPhotoUri(labelSaved);
      setFiche(nextFiche);
      setStep('result');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('wineScan.failedBody');
      houseAlert(t('common.error'), message);
    } finally {
      setBusy(false);
    }
  }, [draftUri, ensureUploadNotice, language, t]);

  const canConfirm =
    Boolean(fiche) && RatingValue.isStarRating(drinksRating);

  const confirmUseInDrinks = useCallback(() => {
    if (!fiche || !RatingValue.isStarRating(drinksRating)) return;
    const name = fiche.nameAndEstate.trim();
    const nextFiche: WineLabelFiche = {
      ...fiche,
      userRating: drinksRating,
      userComment: drinksNote.trim() || undefined,
    };
    setPendingWineLabelResult({
      drinksComment: drinksNote.trim(),
      drinksRating,
      ocrText: name,
      croppedUri: null,
      wineLabel: nextFiche,
    });
    allowLeaveRef.current = true;
    router.back();
  }, [drinksNote, drinksRating, fiche, router]);

  const promptDiscardUnsaved = useCallback(
    (onLeave: () => void) => {
      Haptics.warning();
      houseSaveChangesAlert({
        title: t('wineScan.discardUnsaved.title'),
        onYes: () => {
          if (canConfirm) {
            confirmUseInDrinks();
            return;
          }
          allowLeaveRef.current = true;
          onLeave();
        },
        onNo: () => {
          allowLeaveRef.current = true;
          onLeave();
        },
      });
    },
    [canConfirm, confirmUseInDrinks, t],
  );

  const requestLeave = useCallback(
    (leave: () => void) => {
      if (allowLeaveRef.current || !hasUnsavedWork) {
        leave();
        return;
      }
      promptDiscardUnsaved(leave);
    },
    [hasUnsavedWork, promptDiscardUnsaved],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !hasUnsavedWork) return;
      event.preventDefault();
      promptDiscardUnsaved(() => {
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [hasUnsavedWork, navigation, promptDiscardUnsaved]);

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 16;
  const resultScrollRef = useRef<ScrollView>(null);
  const resultScrollYRef = useRef(0);

  const headerRight =
    step === 'result' && fiche ? (
      <HouseToolbarIconButton
        iosName="checkmark"
        androidName="check"
        accessibilityLabel={t('wineScan.confirmA11y')}
        disabled={!canConfirm}
        onPress={confirmUseInDrinks}
      />
    ) : null;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('wineScan.title')}
        showBack
        onBack={() => requestLeave(() => router.back())}
        right={headerRight}
      />

      {step === 'pick' ? (
        <ScrollView
          contentContainerStyle={[styles.pickPad, { paddingBottom: bottomPad }]}
          overScrollMode="never">
          <SerifText size={22} weight="semibold" style={styles.lead}>
            {t('wineScan.lead')}
          </SerifText>
          <Text style={styles.hint}>{t('wineScan.hintVision')}</Text>
          <View style={styles.chooserCard}>
            <PhotoSourceChooserBody
              title={t('wineScan.chooserTitle')}
              onTakePhoto={() => void takePhoto()}
              onImportPhoto={() => void importPhoto()}
            />
          </View>
        </ScrollView>
      ) : null}

      {step === 'crop' && draftUri ? (
        <View style={[styles.cropStage, { paddingBottom: bottomPad }]}>
          <Text style={styles.cropHint}>{t('wineScan.cropHint')}</Text>
          <LabelCropCanvas
            uri={draftUri}
            accessibilityLabel={t('wineScan.cropA11y')}
            onImageSize={(size) => {
              imageSizeRef.current = size;
            }}
            onTransformChange={(transform, viewport) => {
              transformRef.current = transform;
              viewportRef.current = viewport;
            }}
          />
          <View style={styles.cropActions}>
            <Pressable
              onPress={() => void runCropAndAnalyze()}
              disabled={busy || !draftUri}
              accessibilityRole="button"
              accessibilityLabel={t('wineScan.scanAction')}
              style={({ pressed }) => [
                styles.scanBtn,
                (busy || !draftUri) && styles.scanBtnDisabled,
                pressed && !busy && styles.scanBtnPressed,
              ]}>
              <Text style={styles.scanBtnText}>{t('wineScan.scanAction')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setDraftUri(null);
                setStep('pick');
              }}
              disabled={busy}
              style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{t('wineScan.retake')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'result' ? (
        <ScrollView
          ref={resultScrollRef}
          contentContainerStyle={[
            styles.resultPad,
            { paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          overScrollMode="never"
          onScroll={(e) => {
            resultScrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}>
          {fiche ? (
            <>
              <WineLabelFicheView
                fiche={fiche}
                showUserRating={false}
                scrollRef={resultScrollRef}
                scrollYRef={resultScrollYRef}
                scrollBottomInset={bottomPad}
                ratingSlot={
                  <>
                    <WineUserRatingFields
                      rating={drinksRating}
                      onRatingChange={setDrinksRating}
                      note={drinksNote}
                      onNoteChange={setDrinksNote}
                    />
                    {!canConfirm ? (
                      <Text style={styles.ratingHint}>
                        {t('wineScan.ratingRequired')}
                      </Text>
                    ) : null}
                  </>
                }
              />
            </>
          ) : (
            <Text style={styles.noMatch}>{t('wineScan.noMatchBody')}</Text>
          )}

          <Pressable
            onPress={() => {
              setDraftUri(null);
              setLabelPhotoUri(null);
              setFiche(null);
              setDrinksRating(RatingValue.unrated);
              setDrinksNote('');
              setStep('pick');
            }}
            style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('wineScan.retake')}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={GustraColors.forestGreen} />
          <Text style={styles.busyText}>{t('wineScan.thinking')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  pickPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  lead: {
    color: GustraColors.ink,
  },
  hint: {
    ...bodyTextStyle,
    color: 'rgba(35, 32, 26, 0.62)',
    marginBottom: 8,
  },
  chooserCard: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cropStage: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 8,
    justifyContent: 'flex-start',
  },
  cropHint: {
    ...captionTextStyle,
    textAlign: 'center',
    color: 'rgba(35, 32, 26, 0.6)',
    marginTop: 8,
  },
  cropActions: {
    gap: 4,
  },
  scanBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Theme.radius.lg,
    backgroundColor: GustraColors.forestGreen,
  },
  scanBtnDisabled: {
    opacity: 0.55,
  },
  scanBtnPressed: {
    opacity: 0.85,
  },
  scanBtnText: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultPad: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  ratingHint: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
    marginTop: 8,
  },
  noMatch: {
    ...bodyTextStyle,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
    marginVertical: 24,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(245, 238, 221, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  busyText: {
    ...bodyTextStyle,
    color: GustraColors.forestGreen,
    fontWeight: '600',
  },
});
