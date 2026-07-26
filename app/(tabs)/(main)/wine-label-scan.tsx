import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabelCropCanvas } from '@/components/wine/LabelCropCanvas';
import { WineLabelFicheView } from '@/components/wine/WineLabelFicheView';
import { houseAlert } from '@/components/ui/HouseAlert';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { PhotoSourceChooserBody } from '@/components/ui/PhotoSourceChooser';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import type { WineLabelFiche } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { GeminiAPIConfig } from '@/constants/GeminiAPIConfig';
import { safeOpenSettings } from '@/services/linking/safeLinking';
import {
  renderCroppedLabel,
  type CropTransform,
  type ImageSize,
  type LabelCropViewport,
} from '@/services/photos/labelCrop';
import { saveReviewPhoto } from '@/services/reviews/photoStorage';
import { identifyWineLabel } from '@/services/wine/identifyWineLabel';
import { setPendingWineLabelResult } from '@/services/wine/pendingWineLabelResult';
import {
  hasSeenWineVisionUploadNotice,
  markWineVisionUploadNoticeSeen,
} from '@/services/wine/wineVisionConsent';
import { formatWineLabelDrinksComment } from '@/services/wine/wineLabelTypes';

type Step = 'pick' | 'crop' | 'result';

/**
 * Drinks → Scan wine label: photo → crop → Gemini Vision → fiche → use in Drinks.
 */
export default function WineLabelScanScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('pick');
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [labelPhotoUri, setLabelPhotoUri] = useState<string | null>(null);
  const [fiche, setFiche] = useState<WineLabelFiche | null>(null);
  const [busy, setBusy] = useState(false);

  const imageSizeRef = useRef<ImageSize | null>(null);
  const transformRef = useRef<CropTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const viewportRef = useRef<LabelCropViewport>({ width: 280, height: 400 });

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

      // One Vision call on the original draft (optimized inside identifyWineLabel).
      const result = await identifyWineLabel(draftUri);
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
  }, [draftUri, ensureUploadNotice, t]);

  const useInDrinks = useCallback(() => {
    if (!fiche) {
      router.back();
      return;
    }
    const comment = formatWineLabelDrinksComment(fiche);
    setPendingWineLabelResult({
      drinksComment: comment,
      ocrText: comment,
      croppedUri: labelPhotoUri ?? fiche.labelPhotoUri,
      wineLabel: fiche,
    });
    router.back();
  }, [fiche, labelPhotoUri, router]);

  const bottomPad = insets.bottom + 20;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('wineScan.title')}
        showBack
        onBack={() => router.back()}
        right={
          step === 'crop' ? (
            <Pressable
              onPress={() => void runCropAndAnalyze()}
              disabled={busy || !draftUri}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('wineScan.readLabel')}
              style={styles.headerBtn}>
              {busy ? (
                <ActivityIndicator color={GustraColors.gold} />
              ) : (
                <Text style={[styles.headerBtnText, styles.headerBtnEmph]}>
                  {t('wineScan.readLabel')}
                </Text>
              )}
            </Pressable>
          ) : null
        }
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
          <Pressable
            onPress={() => {
              setDraftUri(null);
              setStep('pick');
            }}
            style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('wineScan.retake')}</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'result' ? (
        <ScrollView
          contentContainerStyle={[
            styles.resultPad,
            { paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          overScrollMode="never">
          {fiche ? (
            <>
              <WineLabelFicheView fiche={fiche} />
              <Pressable
                onPress={useInDrinks}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed,
                ]}
                accessibilityRole="button">
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="wineglass"
                    size={18}
                    tintColor="#FFFFFF"
                    weight="semibold"
                  />
                ) : (
                  <MaterialIcons name="local-bar" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.primaryBtnText}>
                  {t('wineScan.useInDrinks')}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.noMatch}>{t('wineScan.noMatchBody')}</Text>
          )}

          <Pressable
            onPress={() => {
              setFiche(null);
              setLabelPhotoUri(null);
              setStep('crop');
            }}
            style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('wineScan.adjustCrop')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setDraftUri(null);
              setLabelPhotoUri(null);
              setFiche(null);
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
          <Text style={styles.busyText}>{t('wineScan.analyzing')}</Text>
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
  headerBtn: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBtnText: {
    ...bodyTextStyle,
    fontSize: 17,
    color: '#FFFFFF',
  },
  headerBtnEmph: {
    fontWeight: '700',
    color: GustraColors.gold,
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
    gap: 12,
  },
  cropHint: {
    ...captionTextStyle,
    textAlign: 'center',
    color: 'rgba(35, 32, 26, 0.6)',
    marginTop: 8,
  },
  resultPad: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  noMatch: {
    ...bodyTextStyle,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
    marginVertical: 24,
  },
  primaryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: GustraColors.forestGreen,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryBtnPressed: {
    opacity: 0.88,
  },
  primaryBtnText: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
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
    ...StyleSheet.absoluteFillObject,
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
