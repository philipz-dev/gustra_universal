import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useGoogleApiTracker } from '@/context/GoogleApiTracker';
import { usePassportDisplaySettings } from '@/context/PassportDisplaySettings';
import { usePhotoQualitySettings } from '@/context/PhotoQualitySettings';
import {
  REVIEWER_MAX_NAME_LENGTH,
  useReviewerProfile,
} from '@/context/ReviewerProfile';
import { useReviewsStore } from '@/context/ReviewsStore';
import { useShareImportLaunch } from '@/context/ShareImportLaunch';
import { getPhotosDiskUsage } from '@/services/photos/diskUsage';
import { scanSwiftLegacyData } from '@/services/migration/SwiftDataMigration';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const nameInputRef = useRef<TextInput>(null);
  const {
    categoryAveragesStyle,
    categoryAveragesToggleTitle,
    toggleCategoryAveragesStyle,
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
  const { name, photoUri, updateName, ready } = useReviewerProfile();
  const { reviews, importSwiftLegacyData } = useReviewsStore();
  const { pickSharePackage } = useShareImportLaunch();
  const [reviewerNameDraft, setReviewerNameDraft] = useState('');
  const [photosSubtitle, setPhotosSubtitle] = useState('0 photos stored locally');
  const [photosBytesLabel, setPhotosBytesLabel] = useState('0 B');
  const [swiftScanLabel, setSwiftScanLabel] = useState<string | null>(null);

  const refreshPhotosUsage = useCallback(async () => {
    // Swift BackupRestoreView.refreshPhotosStorageInfo — prune orphans first.
    try {
      const { performStartupPhotoMaintenance } = await import(
        '@/services/photos/orphanCleanup'
      );
      await performStartupPhotoMaintenance(reviews);
    } catch {
      // ignore cleanup errors; still show usage
    }
    const usage = await getPhotosDiskUsage();
    setPhotosSubtitle(usage.subtitle);
    setPhotosBytesLabel(usage.formattedBytes);
  }, [reviews]);

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
              'Swift database found',
              scan.photoCount > 0 ? `${scan.photoCount} photos` : null,
              scan.localBackupCount > 0
                ? `${scan.localBackupCount} .gustra backup(s)`
                : null,
            ].filter(Boolean);
            setSwiftScanLabel(bits.join(' · '));
          } else if (scan.localBackupCount > 0) {
            setSwiftScanLabel(
              `${scan.localBackupCount} .gustra backup(s) in Backups — use Backup / Restore`,
            );
          } else if (scan.photoCount > 0) {
            setSwiftScanLabel(
              `${scan.photoCount} old photos found, but no database`,
            );
          } else {
            setSwiftScanLabel('No previous Swift data found on this device');
          }
        } catch {
          setSwiftScanLabel(null);
        }
      })();
    }, [refreshPhotosUsage]),
  );

  const confirmImportSwiftLegacy = () => {
    houseAlert(
      'Recover previous reviews?',
      'This looks for the old Swift database and photos still on this iPhone, then replaces the current demo/local reviews with that data. Encrypted .gustra backups are not opened here — use Backup / Restore for those.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recover',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const result = await importSwiftLegacyData();
                houseAlert(
                  'Recovery complete',
                  `Imported ${result.reviewCount} reviews across ${result.restaurantCount} restaurants (${result.photosCopied} photos copied).`,
                );
                void refreshPhotosUsage();
              } catch (error) {
                houseAlert(
                  'Recovery failed',
                  error instanceof Error
                    ? error.message
                    : 'Could not import previous Gustra data.',
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
      'Reset counters?',
      'Today and all-time Google API usage counters will be cleared on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
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
      <SettingsSection title="Reviewer">
        <View style={styles.reviewerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              photoUri ? 'Edit profile photo' : 'Add profile photo'
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
              placeholder="Your name"
              placeholderTextColor="rgba(36, 78, 57, 0.45)"
              style={styles.nameInput}
              accessibilityLabel="Reviewer name"
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
                accessibilityLabel="Clear name"
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

      <SettingsSection title="Review criteria">
        <SettingsRow
          title="Edit review criteria"
          showChevron
          isLast
          onPress={() => router.push('/edit-criteria')}
        />
      </SettingsSection>

      <SettingsSection title="My Gustra">
        <SettingsRow
          title={categoryAveragesToggleTitle}
          accent
          isLast
          onPress={toggleCategoryAveragesStyle}
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

      <SettingsSection title="Storage">
        <View style={[styles.rowPad, styles.rowBorder]}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Data savings for photos</Text>
            <Text style={styles.rowSubtitle}>
              {isDataSavingsEnabled ? 'Lower resolution' : 'Higher resolution'}
            </Text>
          </View>
          <GustraSwitch
            value={isDataSavingsEnabled}
            onValueChange={setDataSavingsEnabled}
          />
        </View>
        <View style={styles.rowPad}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Photos</Text>
            <Text style={styles.rowSubtitle}>{photosSubtitle}</Text>
          </View>
          <Text style={styles.secondaryValue}>{photosBytesLabel}</Text>
        </View>
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          title="Import shared reviews"
          subtitle="Open a .gustrashare file from a friend"
          showChevron
          onPress={() => {
            void pickSharePackage();
          }}
        />
        {Platform.OS === 'ios' ? (
          <SettingsRow
            title="Recover previous Gustra data"
            subtitle={
              swiftScanLabel ??
              'Search this iPhone for the old Swift database and photos'
            }
            showChevron
            onPress={confirmImportSwiftLegacy}
          />
        ) : null}
        <SettingsRow
          title="Backup / Restore"
          showChevron
          isLast
          onPress={() => router.push('/backup-restore')}
        />
      </SettingsSection>

      <SettingsSection title="Google API Usage">
        <View style={[styles.apiRow, styles.rowBorder]}>
          <Text style={styles.rowTitle}>Google Maps SDK</Text>
          <SerifText size={15} weight="semibold" style={styles.apiValue}>
            {mapsToday} today / {mapsTotal} all-time
          </SerifText>
        </View>
        <View style={[styles.apiRow, styles.rowBorder]}>
          <Text style={styles.rowTitle}>Google Places API</Text>
          <SerifText size={15} weight="semibold" style={styles.apiValue}>
            {placesToday} today / {placesTotal} all-time
          </SerifText>
        </View>
        <SettingsRow
          title="Reset counters"
          destructive
          isLast
          onPress={confirmResetCounters}
        />
      </SettingsSection>
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
