import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { houseAlert } from '@/components/ui/HouseAlert';
import { Haptics } from '@/services/haptics';
import { safeOpenSettings } from '@/services/linking/safeLinking';
import {
  MAX_REVIEW_PHOTOS,
  remainingReviewPhotoSlots,
} from '@/services/reviews/photoLimits';
import { saveReviewPhoto, deleteReviewPhotoFiles } from '@/services/reviews/photoStorage';
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

  const importFromLibrary = async () => {
    const slots = remainingReviewPhotoSlots(photoUrlsRef.current.length);
    if (slots <= 0) {
      warnPhotoLimit();
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
    setIsImportingPhotos(true);
    try {
      const saved: string[] = [];
      for (const asset of assets) {
        if (!asset.uri) continue;
        saved.push(await saveReviewPhoto(asset.uri));
      }
      if (saved.length) {
        Haptics.light();
        setPhotoUrls((prev) => {
          const cleaned = prev.map((u) => u.trim()).filter(Boolean);
          const room = remainingReviewPhotoSlots(cleaned.length);
          const next = [...cleaned, ...saved.slice(0, room)];
          photoUrlsRef.current = next;
          return next;
        });
        afterPhotoChange();
      }
    } catch {
      Haptics.error();
      houseAlert(t('forms.review.photos'), t('alerts.reviewForm.photosSaveFailed'));
    } finally {
      setIsImportingPhotos(false);
    }
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
    importFromLibrary,
    takePhoto,
    showPhotoSourcePicker,
    confirmRemoveSelectedPhotos,
    togglePhotoSelection,
  };
}
