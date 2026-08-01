import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguagePickerSheet } from '@/components/settings/LanguagePickerSheet';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { houseAlert } from '@/components/ui/HouseAlert';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { SERIF_FONT, Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useGoogleApiTracker } from '@/context/GoogleApiTracker';
import { useLanguageSettings } from '@/context/LanguageSettings';
import { useKeyboardBottomInset } from '@/hooks/useKeyboardBottomInset';
import { usePassportDisplaySettings } from '@/context/PassportDisplaySettings';
import { usePhotoQualitySettings } from '@/context/PhotoQualitySettings';
import {
  REVIEWER_MAX_NAME_LENGTH,
  useReviewerProfile,
} from '@/context/ReviewerProfile';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import { useShareImportLaunch } from '@/context/ShareImportLaunch';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import type { LanguagePreference } from '@/i18n/resolveLanguage';
import { useAdvancedMenuUnlocked } from '@/context/AdvancedMenu';
import { getPhotosDiskUsage } from '@/services/photos/diskUsage';
import { Haptics } from '@/services/haptics';
import { scanSwiftLegacyData } from '@/services/migration/SwiftDataMigration';
import { isSentryEnabled, Sentry } from '@/services/monitoring/sentry';

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
  const keyboardHeight = useKeyboardBottomInset();
  const nameInputRef = useRef<TextInput>(null);
  const { preference, setPreference } = useLanguageSettings();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const advancedUnlocked = useAdvancedMenuUnlocked();
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
    geminiToday,
    geminiTotal,
    resetAll: resetApiCounters,
  } = useGoogleApiTracker();
  const { name, photoUri, hasPhoto, updateName, ready, syncPhotoFromDisk } =
    useReviewerProfile();
  const { reviews, restaurants, importSwiftLegacyData, demoShowcaseEnabled, setDemoShowcaseEnabled } =
    useReviewsStore();
  const { pickSharePackage } = useShareImportLaunch();
  const { reopenCriteriaSetupForDev } = useCriteriaSettings();
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

  const appVersionLabel = useMemo(() => {
    const version = Constants.expoConfig?.version?.trim() || '1.0';
    const build =
      Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.buildNumber?.trim() ||
          Constants.nativeBuildVersion?.trim() ||
          ''
        : Platform.OS === 'android'
          ? String(
              Constants.expoConfig?.android?.versionCode ??
                Constants.nativeBuildVersion ??
                '',
            ).trim()
          : '';
    return build ? `${version}(${build})` : version;
  }, []);

  return (
    <View style={styles.screenWrap}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              (keyboardHeight > 0
                ? keyboardHeight
                : Theme.spacing.floatingTabBarClearance + insets.bottom) + 24,
          },
        ]}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
      <SettingsSection title={t('settings.sectionReviewer')}>
        <View style={styles.reviewerBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              photoUri
                ? t('settings.editPhotoA11y')
                : t('settings.addPhotoA11y')
            }
            onPress={() => router.push('/reviewer-photo')}
            style={({ pressed }) => [
              styles.avatarWrap,
              pressed && styles.pressed,
            ]}>
            <View style={styles.avatar}>
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
                  size={24}
                />
              )}
            </View>
          </Pressable>
          <View style={styles.profileCopy}>
            <Text style={styles.profileCaption}>
              {t('settings.editPhotoHint')}
            </Text>
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
                keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
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
        </View>
        <SettingsRow
          title={t('settings.language')}
          subtitle={languagePreferenceLabel(preference, t)}
          icon={{ ios: 'globe', android: 'language', web: 'language' }}
          showChevron
          isLast
          onPress={() => setLanguagePickerOpen(true)}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionReviewing')}>
        <SettingsRow
          title={t('settings.editCriteria')}
          icon={{
            ios: 'list.bullet',
            android: 'format_list_bulleted',
            web: 'format_list_bulleted',
          }}
          showChevron
          isLast
          onPress={() => router.push('/edit-criteria')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionPassport')}>
        <SettingsRow
          title={categoryAveragesToggleTitle}
          icon={{ ios: 'star.fill', android: 'star', web: 'star' }}
          accent
          iconTint="accent"
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
        <SettingsRow
          title={t('settings.dataSavings')}
          subtitle={
            isDataSavingsEnabled
              ? t('settings.dataSavingsOn')
              : t('settings.dataSavingsOff')
          }
          icon={{
            ios: 'arrow.down.circle',
            android: 'data_saver_on',
            web: 'data_saver_on',
          }}
          trailing={
            <GustraSwitch
              value={isDataSavingsEnabled}
              onValueChange={setDataSavingsEnabled}
            />
          }
        />
        <SettingsRow
          title={t('settings.photos')}
          subtitle={photosSubtitle}
          icon={{
            ios: 'photo.on.rectangle',
            android: 'photo_library',
            web: 'photo_library',
          }}
          isLast
          trailing={
            <Text style={styles.secondaryValue}>{photosBytesLabel}</Text>
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionShowcase')}>
        <SettingsRow
          title={t('settings.demoShowcase')}
          subtitle={
            demoShowcaseEnabled
              ? t('settings.demoShowcaseOn')
              : t('settings.demoShowcaseOff')
          }
          icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
          iconTint="accent"
          isLast
          trailing={
            <GustraSwitch
              value={demoShowcaseEnabled}
              onValueChange={(next) => {
                Haptics.selectionChanged();
                void setDemoShowcaseEnabled(next);
              }}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionData')}>
        <SettingsRow
          title={t('settings.backupRestore')}
          icon={{
            ios: 'externaldrive',
            android: 'settings_backup_restore',
            web: 'settings_backup_restore',
          }}
          showChevron
          isLast
          onPress={() => router.push('/backup-restore')}
        />
      </SettingsSection>

      {advancedUnlocked ? (
        <SettingsSection title={t('settings.sectionAdvanced')}>
          <SettingsRow
            title={t('settings.importShared')}
          subtitle={t('settings.importSharedSubtitle')}
          icon={{
            ios: 'square.and.arrow.down',
            android: 'download',
            web: 'download',
          }}
          showChevron
          onPress={() => {
            void pickSharePackage();
          }}
        />
        <SettingsRow
          title={t('settings.mapsSdk')}
          icon={{ ios: 'map.fill', android: 'map', web: 'map' }}
          trailing={
            <SerifText size={15} weight="semibold" style={styles.apiValue}>
              {t('settings.usageToday', {
                today: mapsToday,
                allTime: mapsTotal,
              })}
            </SerifText>
          }
        />
        <SettingsRow
          title={t('settings.placesApi')}
          icon={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
          trailing={
            <SerifText size={15} weight="semibold" style={styles.apiValue}>
              {t('settings.usageToday', {
                today: placesToday,
                allTime: placesTotal,
              })}
            </SerifText>
          }
        />
        <SettingsRow
          title={t('settings.geminiApi')}
          icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
          iconTint="accent"
          trailing={
            <SerifText size={15} weight="semibold" style={styles.apiValue}>
              {t('settings.usageToday', {
                today: geminiToday,
                allTime: geminiTotal,
              })}
            </SerifText>
          }
        />
        <SettingsRow
          title={t('settings.resetCounters')}
          icon={{
            ios: 'arrow.counterclockwise',
            android: 'restart_alt',
            web: 'restart_alt',
          }}
          destructive
          isLast={Platform.OS !== 'ios' && !__DEV__}
          onPress={confirmResetCounters}
        />
        {Platform.OS === 'ios' ? (
          <SettingsRow
            title={t('settings.recoverPrevious')}
            subtitle={swiftScanLabel ?? t('settings.recoverScanSubtitle')}
            icon={{
              ios: 'clock.arrow.circlepath',
              android: 'history',
              web: 'history',
            }}
            showChevron
            isLast={!__DEV__}
            onPress={confirmImportSwiftLegacy}
          />
        ) : null}
        {__DEV__ ? (
          <>
            <SettingsRow
              title={t('settings.showCriteriaSetup')}
              subtitle={t('settings.showCriteriaSetupSubtitle')}
              icon={{
                ios: 'slider.horizontal.3',
                android: 'tune',
                web: 'tune',
              }}
              showChevron
              onPress={() => {
                Haptics.selectionChanged();
                void (async () => {
                  await reopenCriteriaSetupForDev();
                  router.push('/criteria-setup');
                })();
              }}
            />
            <SettingsRow
              title={t('settings.sentryTestCrash')}
              subtitle={
                isSentryEnabled
                  ? t('settings.sentryTestCrashSubtitle')
                  : t('settings.sentryTestCrashNoDsn')
              }
              icon={{
                ios: 'ant',
                android: 'bug_report',
                web: 'bug_report',
              }}
              showChevron
              isLast
              onPress={() => {
                Haptics.selectionChanged();
                if (!isSentryEnabled) {
                  houseAlert(
                    t('settings.sentryTestCrash'),
                    t('settings.sentryTestCrashNoDsn'),
                  );
                  return;
                }
                Sentry.captureException(
                  new Error('Gustra Sentry test — safe to ignore'),
                );
                houseAlert(
                  t('settings.sentryTestCrash'),
                  t('settings.sentryTestCrashSent'),
                );
              }}
            />
          </>
        ) : null}
        </SettingsSection>
      ) : null}

      <Text
        style={styles.versionFooter}
        accessibilityRole="text"
        accessibilityLabel={t('settings.appVersionA11y', {
          version: appVersionLabel,
        })}>
        {appVersionLabel}
      </Text>

      <LanguagePickerSheet
        visible={languagePickerOpen}
        selected={preference}
        onClose={() => setLanguagePickerOpen(false)}
        onSelect={setPreference}
      />
      </ScrollView>

      <View
        pointerEvents="none"
        style={[
          styles.bottomSolid,
          { height: Theme.spacing.floatingTabBarClearance + insets.bottom },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bottomFade,
          { bottom: Theme.spacing.floatingTabBarClearance + insets.bottom },
        ]}>
        <LinearGradient
          colors={['rgba(245, 240, 225, 0)', GustraColors.cream]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  /** Bottom fade over the floating tab bar (same as Reviews feed). */
  bottomSolid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GustraColors.cream,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Theme.size.fab + 24,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: Theme.list.sectionGap + 4,
  },
  versionFooter: {
    ...captionTextStyle,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  reviewerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileCopy: {
    flex: 1,
    gap: 8,
  },
  profileCaption: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  nameField: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  nameInput: {
    flex: 1,
    fontFamily: SERIF_FONT,
    fontSize: 18,
    color: GustraColors.forestGreen,
    paddingVertical: 10,
    textAlign: 'center',
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryValue: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.5)',
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
