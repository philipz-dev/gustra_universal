import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle } from '@/constants/Theme';
import { useReviewerProfile } from '@/context/ReviewerProfile';

/** Matches Swift `ImageCompressionService.matchingReviewPhotoMaxPixelSide`. */
const MAX_PHOTO_SIDE = 480;

async function prepareProfileJpeg(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_PHOTO_SIDE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

function openSettingsAlert(message: string) {
  Alert.alert('Permission needed', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => void Linking.openSettings() },
  ]);
}

/**
 * Full-screen reviewer photo editor (Swift `ReviewerPhotoEditorView`):
 * Take / Import → preview → confirm (checkmark) or discard (close).
 */
export default function ReviewerPhotoEditorScreen() {
  const insets = useSafeAreaInsets();
  const { hasPhoto, photoUri, setPhotoFromUri, clearPhoto } =
    useReviewerProfile();

  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pickingSource, setPickingSource] = useState(false);
  const [startedWithSavedPhoto, setStartedWithSavedPhoto] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setDraftUri(uri);
    setPendingDelete(false);
    setPickingSource(false);
  }, []);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        'Camera access is required to take a profile photo. Enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setBusy(true);
    try {
      const prepared = await prepareProfileJpeg(result.assets[0].uri);
      setDraft(prepared);
    } catch {
      Alert.alert('Storage', 'Could not read the selected photo.');
    } finally {
      setBusy(false);
    }
  }, [setDraft]);

  const importPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        'Photo library access is required to import a profile photo. Enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setBusy(true);
    try {
      const prepared = await prepareProfileJpeg(result.assets[0].uri);
      setDraft(prepared);
    } catch {
      Alert.alert('Storage', 'Could not read the selected photo.');
    } finally {
      setBusy(false);
    }
  }, [setDraft]);

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
        await setPhotoFromUri(draftUri);
        router.navigate('/settings');
        return;
      }
      if (pendingDelete) {
        await clearPhoto();
        router.navigate('/settings');
      }
    } catch (error) {
      Alert.alert(
        'Storage',
        error instanceof Error ? error.message : 'Could not save the photo.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, canConfirm, clearPhoto, draftUri, pendingDelete, setPhotoFromUri]);

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.toolbar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
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
            accessibilityLabel="Use Photo"
            hitSlop={8}
            disabled={!canConfirm || busy}
            onPress={() => void confirm()}
            style={({ pressed }) => [
              styles.toolButton,
              (!canConfirm || busy) && styles.toolDisabled,
              pressed && canConfirm && styles.pressed,
            ]}>
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
          </Pressable>
        ) : (
          <View style={styles.toolSpacer} />
        )}
      </View>

      {showsSourceChooser ? (
        <View style={styles.chooser}>
          <View style={styles.chooserIcon}>
            {busy ? (
              <ActivityIndicator color={GustraColors.forestGreen} size="large" />
            ) : (
              <SymbolView
                name={{
                  ios: 'camera.fill',
                  android: 'photo_camera',
                  web: 'photo_camera',
                }}
                size={36}
                tintColor={GustraColors.forestGreen}
              />
            )}
          </View>
          <Text style={styles.chooserTitle}>Add a profile photo</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void takePhoto()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.primaryLabel}>Take Photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void importPhoto()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.secondaryLabel}>Import Photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.editor}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              previewUri ? 'Profile photo' : 'Add profile photo'
            }
            onPress={() => {
              if (!previewUri) setPickingSource(true);
            }}
            style={styles.cropFrame}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.cropImage} />
            ) : (
              <View style={styles.emptyCrop}>
                <SymbolView
                  name={{
                    ios: 'camera.fill',
                    android: 'photo_camera',
                    web: 'photo_camera',
                  }}
                  size={36}
                  tintColor={GustraColors.forestGreen}
                />
                <Text style={styles.emptyCropLabel}>Take or import a photo</Text>
              </View>
            )}
          </Pressable>

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
                <Text style={styles.deleteLabel}>Delete Photo</Text>
              </Pressable>
            ) : (
              <View style={styles.bottomSpacer} />
            )}
            {pendingDelete ? (
              <Text style={styles.pendingDeleteHint}>
                Photo will be removed when you confirm.
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
  chooser: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
    paddingBottom: Theme.spacing.floatingTabBarClearance,
  },
  chooserIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  chooserTitle: {
    ...bodyTextStyle,
    fontSize: 18,
    fontWeight: '600',
    color: GustraColors.forestGreen,
    marginBottom: 8,
  },
  editor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Theme.spacing.floatingTabBarClearance + 8,
  },
  cropFrame: {
    width: '86%',
    aspectRatio: 1,
    borderRadius: 9999,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(36, 78, 57, 0.25)',
    borderStyle: 'dashed',
  },
  cropImage: {
    width: '100%',
    height: '100%',
  },
  emptyCrop: {
    flex: 1,
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
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: GustraColors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.forestGreen,
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

