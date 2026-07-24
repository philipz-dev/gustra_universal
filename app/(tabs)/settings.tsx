import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguagePickerSheet } from '@/components/settings/LanguagePickerSheet';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useGoogleApiTracker } from '@/context/GoogleApiTracker';
import { useLanguageSettings } from '@/context/LanguageSettings';
import { usePassportDisplaySettings } from '@/context/PassportDisplaySettings';
import { usePhotoQualitySettings } from '@/context/PhotoQualitySettings';
import {
  REVIEWER_MAX_NAME_LENGTH,
  useReviewerProfile,
} from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import { useShareImportLaunch } from '@/context/ShareImportLaunch';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import type { LanguagePreference } from '@/i18n/resolveLanguage';
import { getPhotosDiskUsage } from '@/services/photos/diskUsage';
import { scanSwiftLegacyData } from '@/services/migration/SwiftDataMigration';

function languagePreferenceLabel(
  preference: LanguagePreference,
  t: (key: string) => string,
): string {
  switch (preference) {
    case 'de':
      return t('settings.languageValueGerman');
    case 'nl':
      return t('settings.languageValueDutch');
    case 'es':
      return t('settings.languageValueSpanish');
    case 'fr':
      return t('settings.languageValueFrench');
    case 'it':
      return t('settings.languageValueItalian');
    case 'en':
      return t('settings.languageValueEnglish');
    default:
      return t('settings.languageValueSystem');
  }
}

export default function SettingsScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const nameInputRef = useRef<TextInput>(null);
  const { preference, setPreference } = useLanguageSettings();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const {
    categoryAveragesStyle,
    categoryAveragesToggleTitle,
    toggleCategoryAveragesStyle,
    ready: passportDisplayReady,
  } = usePassportDisplaySettings();
  const { isDataSavingsEnabled, setDataSavingsEnabled } =
    usePhotoQualitySettings();
  const {
    mapsToday,
    mapsTotal,
    placesToday,
    placesTotal,
    resetAll: resetApiCounters,
  } = useGoogleApiTracker();
  const { name, photoUri, hasPhoto, updateName, ready, syncPhotoFromDisk } =
    useReviewerProfile();
  const { reviews, restaurants, importSwiftLegacyData } = useReviewsStore();
  const { pickSharePackage } = useShareImportLaunch();
  const [reviewerNameDraft, setReviewerNameDraft] = useState('');
  const [photosSubtitle, setPhotosSubtitle] = useState(
    t('settings.storage.photosStored', { count: 0 }),
  );
  const [photosBytesLabel, setPhotosBytesLabel] = useState('0 B');
  const [swiftScanLabel, setSwiftScanLabel] = useState<string | null>(null);

  const refreshPhotosUsage = useCallback(async () => {
    // Swift BackupRestoreView.refreshPhotosStorageInfo — prune orphans first.
    try {
      const { performStartupPhotoMaintenance } = await import(
        '@/services/photos/orphanCleanup'
      );
      // Wait for profile hydrate before deciding to delete reviewer.jpg.
      // UI is source of truth once ready: no avatar ⇒ drop leftover profile file.
      await performStartupPhotoMaintenance(reviews, {
        restaurants,
        keepProfilePhoto: !ready || hasPhoto,
      });
      await syncPhotoFromDisk();
    } catch {
      // ignore cleanup errors; still show usage
    }
    const usage = await getPhotosDiskUsage();
    setPhotosSubtitle(usage.subtitle);
    setPhotosBytesLabel(usage.formattedBytes);
  }, [hasPhoto, ready, restaurants, reviews, syncPhotoFromDisk]);

  useFocusEffect(
    useCallback(() => {
      void refreshPhotosUsage();
      if (Platform.OS !== 'ios') {
        setSwiftScanLabel(null);
        return;
      }
      void (async () => {
        try {
          const scan = await scanSwiftLegacyData();
          if (scan.storeExists) {
            const bits = [
              t('settings.swiftScan.found'),
              scan.candidateStoreUris.length > 1
                ? t('settings.swiftScan.dbCandidates', {
                    count: scan.candidateStoreUris.length,
                  })
                : null,
              scan.photoCount > 0
                ? t('settings.swiftScan.photos', { count: scan.photoCount })
                : null,
              scan.localBackupCount > 0
                ? t('settings.swiftScan.backups', {
                    count: scan.localBackupCount,
                  })
                : null,
              scan.migrationStatus === 'completed'
                ? t('settings.swiftScan.alreadyRecovered')
                : null,
            ].filter(Boolean);
            setSwiftScanLabel(bits.join(' · '));
          } else if (scan.photoCount > 0) {
            setSwiftScanLabel(
              t('settings.swiftScan.photosOnly', { count: scan.photoCount }),
            );
          } else if (scan.localBackupCount > 0) {
            setSwiftScanLabel(
              t('settings.swiftScan.backupsOnly', {
                count: scan.localBackupCount,
              }),
            );
          } else if (scan.candidateStoreUris.length > 0) {
            setSwiftScanLabel(
              t('settings.swiftScan.unreadable', {
                count: scan.candidateStoreUris.length,
              }),
            );
          } else {
            setSwiftScanLabel(t('settings.swiftScan.none'));
          }
        } catch {
          setSwiftScanLabel(null);
        }
      })();
    }, [refreshPhotosUsage, t]),
  );

  const confirmImportSwiftLegacy = () => {
    houseAlert(
      t('alerts.recovery.confirmTitle'),
      t('alerts.recovery.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.recover'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const result = await importSwiftLegacyData();
                houseAlert(
                  t('alerts.recovery.completeTitle'),
                  t('alerts.recovery.completeBody', {
                    reviewCount: result.reviewCount,
                    restaurantCount: result.restaurantCount,
                    photosCopied: result.photosCopied,
                    mode: result.mode,
                  }),
                );
                void refreshPhotosUsage();
              } catch (error) {
                houseAlert(
                  t('alerts.recovery.failedTitle'),
                  error instanceof Error
                    ? error.message
                    : t('alerts.recovery.failedBody'),
                );
              }
            })();
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!ready) return;
    setReviewerNameDraft(name);
    // Hydrate once when profile loads (avoid resetting draft while typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name only at ready
  }, [ready]);

  const onNameChange = (value: string) => {
    const next =
      value.length > REVIEWER_MAX_NAME_LENGTH
        ? value.slice(0, REVIEWER_MAX_NAME_LENGTH)
        : value;
    setReviewerNameDraft(next);
    updateName(next);
  };

  const clearName = () => {
    setReviewerNameDraft('');
    updateName('');
    nameInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const confirmResetCounters = () => {
    houseAlert(
      t('alerts.resetCounters.title'),
      t('alerts.resetCounters.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: () => void resetApiCounters(),
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
        },
      ]}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <SettingsSection title={t('settings.sectionReviewer')}>
        <View style={styles.reviewerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              photoUri
                ? t('settings.editPhotoA11y')
                : t('settings.addPhotoA11y')
            }
            onPress={() => router.push('/reviewer-photo')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <SymbolView
                name={{
                  ios: 'camera.fill',
                  android: 'photo_camera',
                  web: 'photo_camera',
                }}
                tintColor="rgba(36, 78, 57, 0.7)"
                size={26}
              />
            )}
          </Pressable>
          <View style={styles.nameField}>
            <TextInput
              ref={nameInputRef}
              value={reviewerNameDraft}
              onChangeText={onNameChange}
              placeholder={t('settings.namePlaceholder')}
              placeholderTextColor="rgba(36, 78, 57, 0.45)"
              style={styles.nameInput}
              accessibilityLabel={t('settings.nameA11y')}
              maxLength={REVIEWER_MAX_NAME_LENGTH}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => {
                nameInputRef.current?.blur();
                Keyboard.dismiss();
              }}
            />
            {reviewerNameDraft.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.clearNameA11y')}
                hitSlop={8}
                onPress={clearName}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{
                    ios: 'xmark.circle.fill',
                    android: 'cancel',
                    web: 'cancel',
                  }}
                  size={22}
                  tintColor="rgba(36, 78, 57, 0.4)"
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings.sectionCriteria')}>
        <SettingsRow
          title={t('settings.editCriteria')}
          showChevron
          isLast
          onPress={() => router.push('/edit-criteria')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionPassport')}>
        <SettingsRow
          title={categoryAveragesToggleTitle}
          accent
          isLast
          onPress={() => {
            if (!passportDisplayReady) return;
            toggleCategoryAveragesStyle();
          }}
          style={styles.ratingToggleRow}
          trailing={
            <View style={styles.ratingExampleSlot}>
              {categoryAveragesStyle === 'stars' ? (
                <FractionalStarRating score={4} size={24} />
              ) : (
                <SerifText size={20} weight="bold" style={styles.ratingExample}>
                  4/5
                </SerifText>
              )}
            </View>
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionStorage')}>
        <View style={[styles.rowPad, styles.rowBorder]}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{t('settings.dataSavings')}</Text>
            <Text style={styles.rowSubtitle}>
              {isDataSavingsEnabled
                ? t('settings.dataSavingsOn')
                : t('settings.dataSavingsOff')}
            </Text>
          </View>
          <GustraSwitch
            value={isDataSavingsEnabled}
            onValueChange={setDataSavingsEnabled}
          />
        </View>
        <View style={styles.rowPad}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{t('settings.photos')}</Text>
            <Text style={styles.rowSubtitle}>{photosSubtitle}</Text>
          </View>
          <Text style={styles.secondaryValue}>{photosBytesLabel}</Text>
        </View>
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          title={t('settings.importShared')}
          subtitle={t('settings.importSharedSubtitle')}
          showChevron
          onPress={() => {
            void pickSharePackage();
          }}
        />
        {Platform.OS === 'ios' ? (
          <SettingsRow
            title={t('settings.recoverPrevious')}
            subtitle={swiftScanLabel ?? t('settings.recoverScanSubtitle')}
            showChevron
            onPress={confirmImportSwiftLegacy}
          />
        ) : null}
        <SettingsRow
          title={t('settings.backupRestore')}
          showChevron
          isLast
          onPress={() => router.push('/backup-restore')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionGoogle')}>
        <View style={[styles.apiRow, styles.rowBorder]}>
          <Text style={styles.rowTitle}>{t('settings.mapsSdk')}</Text>
          <SerifText size={15} weight="semibold" style={styles.apiValue}>
            {t('settings.usageToday', {
              today: mapsToday,
              allTime: mapsTotal,
            })}
          </SerifText>
        </View>
        <View style={[styles.apiRow, styles.rowBorder]}>
          <Text style={styles.rowTitle}>{t('settings.placesApi')}</Text>
          <SerifText size={15} weight="semibold" style={styles.apiValue}>
            {t('settings.usageToday', {
              today: placesToday,
              allTime: placesTotal,
            })}
          </SerifText>
        </View>
        <SettingsRow
          title={t('settings.resetCounters')}
          destructive
          isLast
          onPress={confirmResetCounters}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionLanguage')}>
        <SettingsRow
          title={t('settings.language')}
          subtitle={languagePreferenceLabel(preference, t)}
          showChevron
          isLast
          onPress={() => setLanguagePickerOpen(true)}
        />
      </SettingsSection>

      <LanguagePickerSheet
        visible={languagePickerOpen}
        selected={preference}
        onClose={() => setLanguagePickerOpen(false)}
        onSelect={setPreference}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: Theme.list.sectionGap,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  nameField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontFamily: SERIF_FONT,
    fontSize: 17,
    color: GustraColors.forestGreen,
    paddingVertical: 8,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...bodyTextStyle,
    fontSize: 16,
    color: GustraColors.ink,
  },
  rowSubtitle: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  secondaryValue: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  apiRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  apiValue: {
    color: GustraColors.forestGreen,
  },
  ratingToggleRow: {
    minHeight: 64,
  },
  ratingExampleSlot: {
    width: 5 * 24 + 4,
    height: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ratingExample: {
    color: GustraColors.forestGreen,
  },
  pressed: {
    opacity: 0.75,
  },
});
