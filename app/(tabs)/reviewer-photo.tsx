import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircularCropCanvas } from '@/components/settings/CircularCropCanvas';
import { PhotoSourceChooserBody } from '@/components/ui/PhotoSourceChooser';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle } from '@/constants/Theme';
import { useReviewerProfile } from '@/context/ReviewerProfile';
import { safeOpenSettings } from '@/services/linking/safeLinking';
import {
  renderCroppedSquare,
  type CropTransform,
  type ImageSize,
} from '@/services/photos/circularCrop';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { i18n } from '@/i18n';

function openSettingsAlert(message: string) {
  houseAlert(i18n.t('alerts.permission.needed'), message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('common.openSettings'), onPress: () => void safeOpenSettings() },
  ]);
}

/**
 * Full-screen reviewer photo editor (Swift `ReviewerPhotoEditorView`):
 * Take / Import → circular pinch/pan crop → confirm (checkmark) or discard.
 */
export default function ReviewerPhotoEditorScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { hasPhoto, photoUri, setPhotoFromUri, clearPhoto } =
    useReviewerProfile();

  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pickingSource, setPickingSource] = useState(false);
  const [startedWithSavedPhoto, setStartedWithSavedPhoto] = useState(false);
  const [busy, setBusy] = useState(false);

  const imageSizeRef = useRef<ImageSize | null>(null);
  const transformRef = useRef<CropTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const diameterRef = useRef(280);

  useEffect(() => {
    if (hasPhoto && photoUri) {
      setStartedWithSavedPhoto(true);
      setDraftUri(photoUri);
      setPickingSource(false);
    } else {
      setPickingSource(true);
    }
  }, [hasPhoto, photoUri]);

  const showsSourceChooser = pickingSource && !draftUri;
  const canConfirm = draftUri != null || pendingDelete;
  const previewUri = useMemo(() => {
    if (pendingDelete) return null;
    return draftUri;
  }, [draftUri, pendingDelete]);

  const setDraft = useCallback((uri: string) => {
    imageSizeRef.current = null;
    transformRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
    setDraftUri(uri);
    setPendingDelete(false);
    setPickingSource(false);
  }, []);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        t('alerts.permission.camera'),
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setDraft(result.assets[0].uri);
  }, [setDraft, t]);

  const importPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        t('alerts.permission.photos'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setDraft(result.assets[0].uri);
  }, [setDraft, t]);

  const markPendingDelete = useCallback(() => {
    setDraftUri(null);
    setPendingDelete(true);
    setPickingSource(false);
  }, []);

  const closeTapped = useCallback(() => {
    if (showsSourceChooser && (pendingDelete || startedWithSavedPhoto)) {
      setPickingSource(false);
      return;
    }
    router.navigate('/settings');
  }, [pendingDelete, showsSourceChooser, startedWithSavedPhoto]);

  const confirm = useCallback(async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      if (draftUri) {
        const size = imageSizeRef.current;
        if (!size) {
          houseAlert(t('alerts.profilePhoto.storageTitle'), t('settings.profilePhoto.readFailed'));
          return;
        }
        const cropped = await renderCroppedSquare({
          uri: draftUri,
          image: size,
          diameter: diameterRef.current,
          transform: transformRef.current,
        });
        await setPhotoFromUri(cropped);
        router.navigate('/settings');
        return;
      }
      if (pendingDelete) {
        await clearPhoto();
        router.navigate('/settings');
      }
    } catch (error) {
      houseAlert(
        t('alerts.profilePhoto.storageTitle'),
        error instanceof Error ? error.message : t('alerts.profilePhoto.storageBody'),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, canConfirm, clearPhoto, draftUri, pendingDelete, setPhotoFromUri, t]);

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.toolbar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={8}
          onPress={closeTapped}
          style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
            size={30}
            tintColor={GustraColors.forestGreen}
          />
        </Pressable>
        {!showsSourceChooser ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings.profilePhoto.usePhoto")}
            hitSlop={8}
            disabled={!canConfirm || busy}
            onPress={() => void confirm()}
            style={({ pressed }) => [
              styles.toolButton,
              (!canConfirm || busy) && styles.toolDisabled,
              pressed && canConfirm && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={GustraColors.forestGreen} />
            ) : (
              <SymbolView
                name={{
                  ios: 'checkmark.circle.fill',
                  android: 'check_circle',
                  web: 'check_circle',
                }}
                size={30}
                tintColor={
                  canConfirm ? GustraColors.forestGreen : 'rgba(36, 78, 57, 0.35)'
                }
              />
            )}
          </Pressable>
        ) : (
          <View style={styles.toolSpacer} />
        )}
      </View>

      {showsSourceChooser ? (
        <PhotoSourceChooserBody
          title={t("settings.profilePhoto.addTitle")}
          isImporting={busy}
          onTakePhoto={() => {
            if (!busy) void takePhoto();
          }}
          onImportPhoto={() => {
            if (!busy) void importPhoto();
          }}
        />
      ) : (
        <View style={styles.editor}>
          {previewUri ? (
            <CircularCropCanvas
              uri={previewUri}
              onImageSize={(size) => {
                imageSizeRef.current = size;
              }}
              onTransformChange={(transform, diameter) => {
                transformRef.current = transform;
                diameterRef.current = diameter;
              }}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settings.profilePhoto.addTitle")}
              onPress={() => setPickingSource(true)}
              style={styles.emptyCrop}>
              <SymbolView
                name={{
                  ios: 'camera.fill',
                  android: 'photo_camera',
                  web: 'photo_camera',
                }}
                size={36}
                tintColor={GustraColors.forestGreen}
              />
              <Text style={styles.emptyCropLabel}>{t('settings.profilePhoto.takeOrImport')}</Text>
            </Pressable>
          )}

          <View style={styles.bottomActions}>
            {previewUri ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={markPendingDelete}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.deleteLabel}>{t('settings.profilePhoto.deletePhoto')}</Text>
              </Pressable>
            ) : (
              <View style={styles.bottomSpacer} />
            )}
            {pendingDelete ? (
              <Text style={styles.pendingDeleteHint}>
                {t('settings.profilePhoto.pendingRemove')}
              </Text>
            ) : previewUri ? (
              <Text style={styles.pendingDeleteHint}>
                {t('settings.profilePhoto.pinchHint')}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toolButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolSpacer: {
    width: 44,
    height: 44,
  },
  toolDisabled: {
    opacity: 0.5,
  },
  editor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Theme.spacing.floatingTabBarClearance + 8,
  },
  emptyCrop: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: 9999,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(36, 78, 57, 0.45)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyCropLabel: {
    ...bodyTextStyle,
    fontSize: 14,
    color: GustraColors.forestGreen,
    textAlign: 'center',
  },
  bottomActions: {
    width: '100%',
    gap: 12,
  },
  deleteButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(199, 71, 66, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ratingAvoid,
  },
  bottomSpacer: {
    height: 48,
  },
  pendingDeleteHint: {
    ...bodyTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
