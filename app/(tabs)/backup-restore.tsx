import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import * as DocumentPicker from 'expo-document-picker';
import { router, useNavigation } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import {
  decryptBackup,
  deleteLocalBackup,
  formatByteCount,
  listLocalBackups,
  makeBackupFilename,
  readBackupFile,
  saveLocalBackup,
  shareBackupFile,
} from '@/services/backup/BackupService';
import {
  backupPasswordError,
  backupPasswordHint,
  isValidBackupPassword,
} from '@/services/backup/passwordPolicy';
import type { BackupImportMode, LocalBackupFile } from '@/services/backup/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { activeIntlLocale } from '@/i18n/formatDates';

type Step =
  | 'home'
  | 'createPassword'
  | 'createDestination'
  | 'restorePick'
  | 'restorePassword'
  | 'restoreMode';

function titleForStep(step: Step, t: (key: string) => string): string {
  switch (step) {
    case 'home':
      return t('tabs.backupRestore');
    case 'createPassword':
    case 'createDestination':
      return t('backup.create');
    default:
      return t('backup.restoreTitle');
  }
}

export default function EncryptedBackupScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { reviews, createEncryptedBackup, importEncryptedBackup } =
    useReviewsStore();

  const [step, setStep] = useState<Step>('home');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [localBackups, setLocalBackups] = useState<LocalBackupFile[]>([]);
  const [pendingBytes, setPendingBytes] = useState<Uint8Array | null>(null);
  const [pendingFilename, setPendingFilename] = useState('');
  const [pendingRestore, setPendingRestore] = useState<Uint8Array | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const canCreate = reviews.length > 0;
  const passwordMeetsPolicy = isValidBackupPassword(password);
  const passwordsMatch =
    passwordMeetsPolicy &&
    passwordConfirm.length > 0 &&
    password === passwordConfirm;
  const canContinueCreate = passwordsMatch;

  const refreshLocalBackups = useCallback(async () => {
    try {
      setLocalBackups(await listLocalBackups());
    } catch {
      setLocalBackups([]);
    }
  }, []);

  useEffect(() => {
    void refreshLocalBackups();
  }, [refreshLocalBackups]);

  const goBack = useCallback(() => {
    setMessage(null);
    setStep((current) => {
      switch (current) {
        case 'home':
          router.navigate('/settings');
          return current;
        case 'createPassword':
          return 'home';
        case 'createDestination':
          return 'createPassword';
        case 'restorePick':
          return 'home';
        case 'restorePassword':
          return 'restorePick';
        case 'restoreMode':
          return 'restorePassword';
      }
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <HouseNavHeader
          title={titleForStep(step, t)}
          titleSize={Theme.navigation.secondaryTitleSize}
          showBack
          onBack={goBack}
        />
      ),
    });
  }, [goBack, navigation, step, t]);

  const runBusy = async (fn: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await fn();
    } finally {
      setIsBusy(false);
    }
  };

  const continueCreatePassword = () => {
    const policyError = backupPasswordError(password);
    if (policyError) {
      setMessage(policyError);
      return;
    }
    if (password !== passwordConfirm) {
      setMessage(t('backup.passwordMismatch'));
      return;
    }
    setMessage(null);
    void runBusy(async () => {
      try {
        const bytes = await createEncryptedBackup(password);
        setPendingBytes(bytes);
        setPendingFilename(makeBackupFilename());
        setStep('createDestination');
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : t('backup.encryptFailed'),
        );
      }
    });
  };

  const saveLocally = () =>
    void runBusy(async () => {
      if (!pendingBytes) return;
      try {
        const { filename } = await saveLocalBackup(
          pendingBytes,
          pendingFilename,
        );
        setMessage(t('backup.fileSaved', { filename }));
        await refreshLocalBackups();
        setStep('home');
        setPassword('');
        setPasswordConfirm('');
        setPendingBytes(null);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : t('backup.encryptFailed'),
        );
      }
    });

  const shareBackup = () =>
    void runBusy(async () => {
      if (!pendingBytes) return;
      try {
        const filename = await shareBackupFile(pendingBytes, pendingFilename);
        setMessage(t('backup.fileShared', { filename }));
        setStep('home');
        setPassword('');
        setPasswordConfirm('');
        setPendingBytes(null);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : t('backup.shareFailed'),
        );
      }
    });

  const pickRestoreFile = (file: LocalBackupFile) =>
    void runBusy(async () => {
      try {
        const data = await readBackupFile(file.uri);
        setPendingRestore(data);
        setPassword('');
        setMessage(null);
        setStep('restorePassword');
      } catch {
        setMessage(t('backup.readFailed'));
      }
    });

  const chooseFromFiles = () =>
    void runBusy(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });
      if (result.canceled || !result.assets[0]) return;
      try {
        const data = await readBackupFile(result.assets[0].uri);
        setPendingRestore(data);
        setPassword('');
        setMessage(null);
        setStep('restorePassword');
      } catch {
        setMessage(t('backup.readFailed'));
      }
    });

  const continueRestorePassword = () => {
    if (!pendingRestore || !password) return;
    try {
      decryptBackup(pendingRestore, password);
      setMessage(null);
      setStep('restoreMode');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t('backup.incorrectPassword'),
      );
    }
  };

  const performRestore = (mode: BackupImportMode) =>
    void runBusy(async () => {
      if (!pendingRestore) return;
      try {
        await importEncryptedBackup(pendingRestore, password, mode);
        setMessage(
          mode === 'merge'
            ? t('backup.mergedSuccess')
            : t('backup.restoredSuccess'),
        );
        setPendingRestore(null);
        setPassword('');
        setStep('home');
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : t('backup.incorrectPassword'),
        );
      }
    });

  const confirmOverwrite = () => {
    houseAlert(
      t('alerts.backup.overwriteTitle'),
      t('alerts.backup.overwriteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.overwrite'),
          style: 'destructive',
          onPress: () => performRestore('overwrite'),
        },
      ],
    );
  };

  const confirmDeleteBackup = (file: LocalBackupFile) => {
    houseAlert(
      t('alerts.backup.deleteFileTitle'),
      t('alerts.backup.deleteFileBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            void runBusy(async () => {
              try {
                await deleteLocalBackup(file.uri);
                await refreshLocalBackups();
              } catch {
                setMessage(t('backup.deleteFailed'));
              }
            }),
        },
      ],
    );
  };

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never">
        {step === 'home' ? (
          <View style={styles.home}>
            <SymbolView
              name={{
                ios: 'externaldrive.fill.badge.timemachine',
                android: 'settings_backup_restore',
                web: 'settings_backup_restore',
              }}
              size={44}
              tintColor={GustraColors.forestGreen}
            />
            <SerifText size={24} weight="bold" style={styles.homeTitle}>
              {t('backup.encryptedTitle')}
            </SerifText>
            <Text style={styles.homeCopy}>
              {t('backup.encryptedBody')}
            </Text>
            <View style={styles.homeActions}>
              <HousePrimaryButton
                title={t("backup.create")}
                disabled={!canCreate}
                onPress={() => {
                  setPassword('');
                  setPasswordConfirm('');
                  setMessage(null);
                  setStep('createPassword');
                }}
              />
              <HousePrimaryButton
                title={t("backup.restore")}
                onPress={() => {
                  setMessage(null);
                  setPassword('');
                  void refreshLocalBackups();
                  setStep('restorePick');
                }}
              />
            </View>
            {!canCreate ? (
              <Text style={styles.hint}>
                {t('backup.needReviewFirst')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 'createPassword' ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>{t('backup.password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            />
            <Text style={styles.fieldLabel}>{t('backup.confirmPassword')}</Text>
            <TextInput
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            />
            <Text style={styles.footerHint}>
              {t('backup.choosePasswordHint')}{'\n'}
              {backupPasswordHint()}
            </Text>
            <HousePrimaryButton
              title={t("backup.continue")}
              disabled={!canContinueCreate}
              onPress={continueCreatePassword}
            />
          </View>
        ) : null}

        {step === 'createDestination' ? (
          <View style={styles.form}>
            <Text style={styles.sectionLead}>{t('backup.whereTitle')}</Text>
            <Text style={styles.footerHint}>
              {t('backup.localFolderHint')}
            </Text>
            <HousePrimaryButton title={t("backup.saveLocally")} onPress={saveLocally} />
            <HousePrimaryButton title={t("backup.share")} onPress={shareBackup} />
          </View>
        ) : null}

        {step === 'restorePick' ? (
          <View style={styles.form}>
            {localBackups.length === 0 ? (
              <>
                <Text style={styles.sectionLead}>{t('backup.noBackups')}</Text>
                <Text style={styles.footerHint}>
                  {t('backup.noBackupsBody')}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.sectionLead}>{t('backup.gustraBackups')}</Text>
                {localBackups.map((file) => (
                  <View key={file.uri} style={styles.backupRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.backupMain,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => pickRestoreFile(file)}>
                      <Text style={styles.backupName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.backupMeta}>
                        {new Date(file.modified).toLocaleString(
                          activeIntlLocale(),
                        )}{' '}
                        · {formatByteCount(file.byteCount)}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Delete ${file.name}`}
                      hitSlop={8}
                      onPress={() => confirmDeleteBackup(file)}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <SymbolView
                        name={{
                          ios: 'trash',
                          android: 'delete',
                          web: 'delete',
                        }}
                        size={20}
                        tintColor={GustraColors.ratingAvoid}
                      />
                    </Pressable>
                  </View>
                ))}
              </>
            )}
            <HousePrimaryButton
              title={t("backup.chooseFromFiles")}
              onPress={chooseFromFiles}
            />
          </View>
        ) : null}

        {step === 'restorePassword' ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>{t('backup.password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            />
            <Text style={styles.footerHint}>
              {t('backup.enterRestorePassword')}
            </Text>
            <HousePrimaryButton
              title={t("backup.continue")}
              disabled={!password}
              onPress={continueRestorePassword}
            />
          </View>
        ) : null}

        {step === 'restoreMode' ? (
          <View style={styles.form}>
            <Text style={styles.sectionLead}>
              {t('backup.applyHow')}
            </Text>
            <HousePrimaryButton
              title={t("backup.merge")}
              onPress={() => performRestore('merge')}
            />
            <Text style={styles.footerHint}>
              {t('backup.mergeHint')}
            </Text>
            <Pressable
              onPress={confirmOverwrite}
              style={({ pressed }) => [
                styles.destructiveButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.destructiveLabel}>{t('backup.overwrite')}</Text>
            </Pressable>
            <Text style={styles.footerHint}>
              {t('backup.overwriteHint')}
            </Text>
          </View>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
      {isBusy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={GustraColors.forestGreen} size="large" />
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  home: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 40,
  },
  homeTitle: {
    color: GustraColors.forestGreen,
    textAlign: 'center',
  },
  homeCopy: {
    ...bodyTextStyle,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(35, 32, 26, 0.7)',
    textAlign: 'center',
  },
  homeActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  hint: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
  },
  form: {
    gap: 12,
  },
  fieldLabel: {
    ...bodyTextStyle,
    fontSize: 14,
    fontWeight: '600',
    color: GustraColors.ink,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(236, 227, 207, 0.65)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: GustraColors.ink,
  },
  footerHint: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
    marginBottom: 4,
  },
  sectionLead: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.ink,
    marginBottom: 4,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  backupMain: {
    flex: 1,
    gap: 2,
  },
  backupName: {
    ...bodyTextStyle,
    fontSize: 15,
    color: GustraColors.ink,
  },
  backupMeta: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  destructiveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(199, 71, 66, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ratingAvoid,
  },
  message: {
    ...bodyTextStyle,
    marginTop: 20,
    fontSize: 14,
    color: GustraColors.forestGreen,
    textAlign: 'center',
  },
  busy: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
