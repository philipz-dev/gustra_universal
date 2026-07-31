import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { PhotoSourceChooserBody } from '@/components/ui/PhotoSourceChooser';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import type { WineLabelFiche } from '@/data/types';
import { useLanguageSettings } from '@/context/LanguageSettings';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useScrollInputIntoView } from '@/hooks/useScrollInputIntoView';
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
import {
  identifyWineByText,
  identifyWineLabel,
} from '@/services/wine/identifyWineLabel';
import { setPendingWineLabelResult } from '@/services/wine/pendingWineLabelResult';
import {
  hasSeenWineVisionUploadNotice,
  markWineVisionUploadNoticeSeen,
} from '@/services/wine/wineVisionConsent';

type Step = 'method' | 'pick' | 'crop' | 'search' | 'result';

/**
 * Drinks → Add wine: scan label or search by name → fiche → confirm ✓.
 */
export default function WineLabelScanScreen() {
  const { t } = useAppTranslation();
  const { language } = useLanguageSettings();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('method');
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [labelPhotoUri, setLabelPhotoUri] = useState<string | null>(null);
  const [fiche, setFiche] = useState<WineLabelFiche | null>(null);
  const [busy, setBusy] = useState(false);
  const [drinksRating, setDrinksRating] = useState(RatingValue.unrated);
  const [drinksNote, setDrinksNote] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchEstate, setSearchEstate] = useState('');
  const [searchYear, setSearchYear] = useState('');

  const allowLeaveRef = useRef(false);
  const imageSizeRef = useRef<ImageSize | null>(null);
  const searchNameRef = useRef<TextInput | null>(null);
  const searchEstateRef = useRef<TextInput | null>(null);
  const searchYearRef = useRef<TextInput | null>(null);
  const transformRef = useRef<CropTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const viewportRef = useRef<LabelCropViewport>({ width: 280, height: 400 });
  const [busyKind, setBusyKind] = useState<'scan' | 'search'>('scan');

  const hasUnsavedWork = useMemo(() => {
    if (fiche) return true;
    if (step === 'crop' && draftUri) return true;
    if (step === 'result' && (labelPhotoUri || draftUri || fiche)) return true;
    if (
      step === 'search' &&
      (searchName.trim() || searchEstate.trim() || searchYear.trim())
    ) {
      return true;
    }
    if (RatingValue.isStarRating(drinksRating) || drinksNote.trim()) return true;
    return false;
  }, [
    draftUri,
    drinksNote,
    drinksRating,
    fiche,
    labelPhotoUri,
    searchEstate,
    searchName,
    searchYear,
    step,
  ]);

  const resetToMethod = useCallback(() => {
    setDraftUri(null);
    setLabelPhotoUri(null);
    setFiche(null);
    setDrinksRating(RatingValue.unrated);
    setDrinksNote('');
    setSearchName('');
    setSearchEstate('');
    setSearchYear('');
    setStep('method');
  }, []);

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
    setBusyKind('scan');
    try {
      const cropped = await renderCroppedLabel({
        uri: draftUri,
        image: imageSizeRef.current,
        viewport: viewportRef.current,
        transform: transformRef.current,
      });
      const savedCrop = await saveReviewPhoto(cropped);

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

  const runTextSearch = useCallback(async () => {
    const name = searchName.trim();
    if (!name) {
      houseAlert(t('common.error'), t('wineScan.nameRequired'));
      return;
    }
    if (!GeminiAPIConfig.isConfigured) {
      houseAlert(t('common.error'), t('wineScan.missingKeyBody'));
      return;
    }

    setBusy(true);
    setBusyKind('search');
    try {
      const result = await identifyWineByText(
        {
          name,
          estate: searchEstate.trim() || undefined,
          vintage: searchYear.trim() || undefined,
        },
        { language },
      );
      if (!result.fiche) {
        setLabelPhotoUri(null);
        setFiche(null);
        setStep('result');
        houseAlert(t('wineScan.noMatchTitle'), t('wineScan.noMatchSearchBody'));
        return;
      }
      setLabelPhotoUri(null);
      setFiche(result.fiche);
      setStep('result');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('wineScan.failedSearchBody');
      houseAlert(t('common.error'), message);
    } finally {
      setBusy(false);
    }
  }, [language, searchEstate, searchName, searchYear, t]);

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
  const {
    scrollRef: resultScrollRef,
    scrollYRef: resultScrollYRef,
    keyboardHeight,
    scrollInputIntoView,
    onScroll: onResultScroll,
  } = useScrollInputIntoView();
  const {
    scrollRef: searchScrollRef,
    keyboardHeight: searchKeyboardHeight,
    scrollInputIntoView: scrollSearchInputIntoView,
    onScroll: onSearchScroll,
  } = useScrollInputIntoView();
  const resultBottomPad =
    keyboardHeight > 0 ? keyboardHeight + 24 : bottomPad;
  const searchBottomPad =
    searchKeyboardHeight > 0 ? searchKeyboardHeight + 24 : bottomPad;

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

  const onHeaderBack = () => {
    if (step === 'pick' || step === 'search') {
      if (step === 'search' && hasUnsavedWork) {
        requestLeave(() => {
          setSearchName('');
          setSearchEstate('');
          setSearchYear('');
          setStep('method');
        });
        return;
      }
      setStep('method');
      return;
    }
    if (step === 'crop') {
      requestLeave(() => {
        setDraftUri(null);
        setStep('pick');
      });
      return;
    }
    if (step === 'result') {
      requestLeave(resetToMethod);
      return;
    }
    requestLeave(() => router.back());
  };

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('wineScan.title')}
        showBack
        onBack={onHeaderBack}
        right={headerRight}
      />

      {step === 'method' ? (
        <ScrollView
          contentContainerStyle={[styles.pickPad, { paddingBottom: bottomPad }]}
          overScrollMode="never">
          <SerifText size={22} weight="semibold" style={styles.lead}>
            {t('wineScan.methodLead')}
          </SerifText>
          <Text style={styles.hint}>{t('wineScan.methodHint')}</Text>
          <View style={styles.chooserCard}>
            <View style={styles.methodBody}>
              <HousePrimaryButton
                title={t('wineScan.methodScan')}
                onPress={() => {
                  Haptics.selectionChanged();
                  setStep('pick');
                }}
              />
              <HousePrimaryButton
                title={t('wineScan.methodSearch')}
                onPress={() => {
                  Haptics.selectionChanged();
                  setStep('search');
                }}
              />
            </View>
          </View>
        </ScrollView>
      ) : null}

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

      {step === 'search' ? (
        <ScrollView
          ref={searchScrollRef}
          contentContainerStyle={[
            styles.pickPad,
            { paddingBottom: searchBottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          overScrollMode="never"
          onScroll={onSearchScroll}
          scrollEventThrottle={16}>
          <SerifText size={22} weight="semibold" style={styles.lead}>
            {t('wineScan.searchLead')}
          </SerifText>
          <Text style={styles.hint}>{t('wineScan.searchHint')}</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('wineScan.searchName')}</Text>
            <TextInput
              ref={searchNameRef}
              value={searchName}
              onChangeText={setSearchName}
              placeholder={t('wineScan.searchNamePlaceholder')}
              placeholderTextColor="rgba(35, 32, 26, 0.35)"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
              style={styles.fieldInput}
              onFocus={() => scrollSearchInputIntoView(searchNameRef.current)}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('wineScan.searchEstate')}</Text>
            <Text style={styles.fieldRecommend}>
              {t('wineScan.searchRecommended')}
            </Text>
            <TextInput
              ref={searchEstateRef}
              value={searchEstate}
              onChangeText={setSearchEstate}
              placeholder={t('wineScan.searchEstatePlaceholder')}
              placeholderTextColor="rgba(35, 32, 26, 0.35)"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
              style={styles.fieldInput}
              onFocus={() => scrollSearchInputIntoView(searchEstateRef.current)}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('wineScan.searchYear')}</Text>
            <Text style={styles.fieldRecommend}>
              {t('wineScan.searchRecommended')}
            </Text>
            <TextInput
              ref={searchYearRef}
              value={searchYear}
              onChangeText={setSearchYear}
              placeholder={t('wineScan.searchYearPlaceholder')}
              placeholderTextColor="rgba(35, 32, 26, 0.35)"
              keyboardType="number-pad"
              maxLength={4}
              returnKeyType="done"
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
              style={styles.fieldInput}
              onFocus={() => scrollSearchInputIntoView(searchYearRef.current)}
              onSubmitEditing={() => void runTextSearch()}
            />
          </View>

          <Pressable
            onPress={() => void runTextSearch()}
            disabled={busy || !searchName.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('wineScan.searchAction')}
            style={({ pressed }) => [
              styles.scanBtn,
              (busy || !searchName.trim()) && styles.scanBtnDisabled,
              pressed && !busy && styles.scanBtnPressed,
            ]}>
            <Text style={styles.scanBtnText}>{t('wineScan.searchAction')}</Text>
          </Pressable>
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
            { paddingBottom: resultBottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          overScrollMode="never"
          onScroll={onResultScroll}
          scrollEventThrottle={16}>
          {fiche ? (
            <WineLabelFicheView
              fiche={fiche}
              showUserRating={false}
              scrollRef={resultScrollRef}
              scrollYRef={resultScrollYRef}
              scrollBottomInset={resultBottomPad}
              ratingSlot={
                <>
                  <WineUserRatingFields
                    rating={drinksRating}
                    onRatingChange={setDrinksRating}
                    note={drinksNote}
                    onNoteChange={setDrinksNote}
                    onNoteFocus={(input) => scrollInputIntoView(input)}
                    onNoteResize={(input) => scrollInputIntoView(input, 0)}
                  />
                  {!canConfirm ? (
                    <Text style={styles.ratingHint}>
                      {t('wineScan.ratingRequired')}
                    </Text>
                  ) : null}
                </>
              }
            />
          ) : (
            <Text style={styles.noMatch}>{t('wineScan.noMatchBody')}</Text>
          )}

          <Pressable onPress={resetToMethod} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('wineScan.tryAgain')}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={GustraColors.forestGreen} />
          <Text style={styles.busyText}>
            {busyKind === 'search'
              ? t('wineScan.searching')
              : t('wineScan.thinking')}
          </Text>
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
  methodBody: {
    padding: 20,
    gap: 12,
  },
  fieldBlock: {
    gap: 4,
  },
  fieldLabel: {
    ...captionTextStyle,
    fontWeight: '700',
    color: 'rgba(35, 32, 26, 0.72)',
  },
  fieldRecommend: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.48)',
    marginBottom: 2,
  },
  fieldInput: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
