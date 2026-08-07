import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { houseAlert } from '@/components/ui/HouseAlert';
import { showHouseUndoSnackbar } from '@/components/ui/HouseUndoSnackbar';
import { Haptics } from '@/services/haptics';
import { safeOpenSettings } from '@/services/linking/safeLinking';
import {
  MAX_REVIEW_PHOTOS,
  remainingReviewPhotoSlots,
} from '@/services/reviews/photoLimits';
import { saveReviewPhoto, deleteReviewPhotoFiles } from '@/services/reviews/photoStorage';
import type { LibraryAsset } from '@/services/reviews/photoLibrary';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type UsePhotoManagerOptions = {
  afterPhotoChange: () => void;
};

export function usePhotoManager({ afterPhotoChange }: UsePhotoManagerOptions) {
  const { t } = useAppTranslation();
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedPhotosForRemoval, setSelectedPhotosForRemoval] = useState<string[]>([]);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [showPhotoSourceChooser, setShowPhotoSourceChooser] = useState(false);
  const [showPhotoLibraryPicker, setShowPhotoLibraryPicker] = useState(false);

  const photoUrlsRef = useRef<string[]>(photoUrls);
  photoUrlsRef.current = photoUrls;

  const openSettingsAlert = useCallback((message: string) => {
    houseAlert(t('alerts.permission.needed'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.openSettings'), onPress: () => void safeOpenSettings() },
    ]);
  }, [t]);

  const warnPhotoLimit = useCallback(() => {
    houseAlert(
      t('alerts.reviewForm.photoLimitTitle'),
      t('alerts.reviewForm.photoLimitBody', { max: MAX_REVIEW_PHOTOS }),
    );
  }, [t]);

  /**
   * Persist a set of library asset refs into the app Photos folder (compressed
   * copies) and append them to the form. Shared by the in-app photo grid (iOS)
   * and the system picker path (Android).
   *
   * Safety net: after import, an Undo snackbar lets the user remove exactly the
   * photos that were just added — so even if the grid selection contained
   * something unintended, one tap restores the previous state.
   */
  const saveLibraryAssets = useCallback(
    async (assets: { uri: string }[]) => {
      const slots = remainingReviewPhotoSlots(photoUrlsRef.current.length);
      if (slots <= 0) {
        warnPhotoLimit();
        return;
      }
      const picked = assets
        .map((a) => a.uri)
        .filter((uri) => uri && uri.trim())
        .slice(0, slots);
      if (picked.length === 0) return;
      setIsImportingPhotos(true);
      try {
        const saved: string[] = [];
        for (const uri of picked) {
          try {
            saved.push(await saveReviewPhoto(uri));
          } catch {
            // Skip individual failures so one broken photo doesn't abort the batch.
          }
        }
        if (saved.length) {
          Haptics.light();
          // Only the photos that actually fit the remaining slots are appended;
          // the undo snackbar removes exactly those (and only those).
          const room = remainingReviewPhotoSlots(photoUrlsRef.current.length);
          const added = saved.slice(0, room);
          setPhotoUrls((prev) => {
            const cleaned = prev.map((u) => u.trim()).filter(Boolean);
            const next = [...cleaned, ...added];
            photoUrlsRef.current = next;
            return next;
          });
          afterPhotoChange();
          showHouseUndoSnackbar({
            message: t('alerts.reviewForm.photosAdded', { count: added.length }),
            actionLabel: t('common.undo'),
            durationMs: 4500,
            onUndo: () => {
              Haptics.light();
              setPhotoUrls((prev) => {
                const removeSet = new Set(added);
                const next = prev.filter((u) => !removeSet.has(u));
                photoUrlsRef.current = next;
                return next;
              });
              void deleteReviewPhotoFiles(added);
              afterPhotoChange();
            },
            onCommit: () => undefined,
          });
        }
      } catch {
        Haptics.error();
        houseAlert(t('forms.review.photos'), t('alerts.reviewForm.photosSaveFailed'));
      } finally {
        setIsImportingPhotos(false);
      }
    },
    [afterPhotoChange, t, warnPhotoLimit],
  );

  /**
   * The user confirmed a selection in the in-app photo grid (iOS). The grid
   * closes and the picked photos are imported into the form.
   */
  const confirmLibraryAssets = useCallback(
    async (assets: LibraryAsset[]) => {
      setShowPhotoLibraryPicker(false);
      requestAnimationFrame(() => {
        void saveLibraryAssets(assets);
      });
    },
    [saveLibraryAssets],
  );

  const importFromLibrary = async () => {
    const slots = remainingReviewPhotoSlots(photoUrlsRef.current.length);
    if (slots <= 0) {
      warnPhotoLimit();
      return;
    }
    // iOS: use the in-app grid instead of the system PHPicker. Scrolling the
    // system picker can drag-select photos and wipe the selection; our own
    // grid keeps tap and scroll strictly separate. The grid reads assets via
    // expo-media-library, so request that permission (same PHPhotoLibrary
    // prompt as the image picker on iOS).
    if (Platform.OS === 'ios') {
      let MediaLibrary: typeof import('expo-media-library/legacy');
      try {
        MediaLibrary = await import('expo-media-library/legacy');
      } catch {
        openSettingsAlert(t('alerts.permission.photos'));
        return;
      }
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        openSettingsAlert(t('alerts.permission.photos'));
        return;
      }
      setShowPhotoLibraryPicker(true);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(t('alerts.permission.photos'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: slots,
    });
    if (result.canceled || result.assets.length === 0) return;
    const assets = result.assets.slice(0, slots);
    if (result.assets.length > slots) {
      warnPhotoLimit();
    }
    await saveLibraryAssets(assets);
  };

  const takePhoto = async () => {
    if (remainingReviewPhotoSlots(photoUrlsRef.current.length) <= 0) {
      warnPhotoLimit();
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(t('alerts.permission.camera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    if (remainingReviewPhotoSlots(photoUrlsRef.current.length) <= 0) {
      warnPhotoLimit();
      return;
    }
    setIsImportingPhotos(true);
    try {
      const uri = await saveReviewPhoto(result.assets[0].uri);
      Haptics.light();
      setPhotoUrls((prev) => {
        const cleaned = prev.map((u) => u.trim()).filter(Boolean);
        if (remainingReviewPhotoSlots(cleaned.length) <= 0) return cleaned;
        const next = [...cleaned, uri];
        photoUrlsRef.current = next;
        return next;
      });
      afterPhotoChange();
    } catch {
      Haptics.error();
      houseAlert(t('forms.review.photos'), t('alerts.photos.saveFailed'));
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const showPhotoSourcePicker = () => {
    if (remainingReviewPhotoSlots(photoUrlsRef.current.length) <= 0) {
      warnPhotoLimit();
      return;
    }
    setShowPhotoSourceChooser(true);
  };

  const confirmRemoveSelectedPhotos = () => {
    if (selectedPhotosForRemoval.length === 0) return;
    const toRemove = [...selectedPhotosForRemoval];
    houseAlert(
      t('alerts.reviewForm.removePhotosTitle'),
      t('alerts.reviewForm.removePhotosBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            const removeSet = new Set(toRemove);
            setPhotoUrls((prev) => {
              const next = prev.filter((u) => !removeSet.has(u));
              photoUrlsRef.current = next;
              return next;
            });
            setSelectedPhotosForRemoval([]);
            void deleteReviewPhotoFiles(toRemove);
            afterPhotoChange();
          },
        },
      ],
    );
  };

  const togglePhotoSelection = (uri: string) => {
    setSelectedPhotosForRemoval((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri],
    );
  };

  return {
    photoUrls,
    setPhotoUrls,
    photoUrlsRef,
    selectedPhotosForRemoval,
    setSelectedPhotosForRemoval,
    isImportingPhotos,
    setIsImportingPhotos,
    showPhotoSourceChooser,
    setShowPhotoSourceChooser,
    showPhotoLibraryPicker,
    setShowPhotoLibraryPicker,
    importFromLibrary,
    takePhoto,
    showPhotoSourcePicker,
    confirmRemoveSelectedPhotos,
    togglePhotoSelection,
    confirmLibraryAssets,
  };
}
