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
  BACKUP_PASSWORD_HINT,
  backupPasswordError,
  isValidBackupPassword,
} from '@/services/backup/passwordPolicy';
import type { BackupImportMode, LocalBackupFile } from '@/services/backup/types';

type Step =
  | 'home'
  | 'createPassword'
  | 'createDestination'
  | 'restorePick'
  | 'restorePassword'
  | 'restoreMode';

function titleForStep(step: Step): string {
  switch (step) {
    case 'home':
      return 'Backup / Restore';
    case 'createPassword':
    case 'createDestination':
      return 'Create Backup';
    default:
      return 'Restore Backup';
  }
}

export default function EncryptedBackupScreen() {
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
          title={titleForStep(step)}
          titleSize={Theme.navigation.secondaryTitleSize}
          showBack
          onBack={goBack}
        />
      ),
    });
  }, [goBack, navigation, step]);

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
      setMessage('Passwords do not match.');
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
            : 'Could not encrypt the backup file.',
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
        setMessage(`Backup file ${filename} saved`);
        await refreshLocalBackups();
        setStep('home');
        setPassword('');
        setPasswordConfirm('');
        setPendingBytes(null);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not encrypt the backup file.',
        );
      }
    });

  const shareBackup = () =>
    void runBusy(async () => {
      if (!pendingBytes) return;
      try {
        const filename = await shareBackupFile(pendingBytes, pendingFilename);
        setMessage(`Backup file ${filename} shared`);
        setStep('home');
        setPassword('');
        setPasswordConfirm('');
        setPendingBytes(null);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Could not share the backup.',
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
        setMessage('Could not read the backup file.');
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
        setMessage('Could not read the backup file.');
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
        error instanceof Error ? error.message : 'Incorrect backup password.',
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
            ? 'Backup merged successfully.'
            : 'Backup restored successfully.',
        );
        setPendingRestore(null);
        setPassword('');
        setStep('home');
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Incorrect backup password.',
        );
      }
    });

  const confirmOverwrite = () => {
    houseAlert(
      'Overwrite existing data?',
      'All current restaurants and reviews will be replaced by this backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Overwrite',
          style: 'destructive',
          onPress: () => performRestore('overwrite'),
        },
      ],
    );
  };

  const confirmDeleteBackup = (file: LocalBackupFile) => {
    houseAlert(
      'Delete backup file?',
      `“${file.name}” will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void runBusy(async () => {
              try {
                await deleteLocalBackup(file.uri);
                await refreshLocalBackups();
              } catch {
                setMessage('Could not delete the backup file.');
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
              Encrypted Backup
            </SerifText>
            <Text style={styles.homeCopy}>
              Save a password-protected copy of your restaurants and reviews, or
              restore from an earlier backup.
            </Text>
            <View style={styles.homeActions}>
              <HousePrimaryButton
                title="Create Backup"
                disabled={!canCreate}
                onPress={() => {
                  setPassword('');
                  setPasswordConfirm('');
                  setMessage(null);
                  setStep('createPassword');
                }}
              />
              <HousePrimaryButton
                title="Restore"
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
                Add at least one review before creating a backup.
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 'createPassword' ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Backup password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Confirm password</Text>
            <TextInput
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.footerHint}>
              Choose a password you will need later to restore this backup.{'\n'}
              {BACKUP_PASSWORD_HINT}
            </Text>
            <HousePrimaryButton
              title="Continue"
              disabled={!canContinueCreate}
              onPress={continueCreatePassword}
            />
          </View>
        ) : null}

        {step === 'createDestination' ? (
          <View style={styles.form}>
            <Text style={styles.sectionLead}>Where should this backup go?</Text>
            <Text style={styles.footerHint}>
              Local backups are stored in the app’s Backups folder on this
              device.
            </Text>
            <HousePrimaryButton title="Save Locally" onPress={saveLocally} />
            <HousePrimaryButton title="Share" onPress={shareBackup} />
          </View>
        ) : null}

        {step === 'restorePick' ? (
          <View style={styles.form}>
            {localBackups.length === 0 ? (
              <>
                <Text style={styles.sectionLead}>No backups found</Text>
                <Text style={styles.footerHint}>
                  No backups found in the Gustra Backups folder. You can still
                  choose a file from elsewhere.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.sectionLead}>Gustra backups</Text>
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
                        {new Date(file.modified).toLocaleString()} ·{' '}
                        {formatByteCount(file.byteCount)}
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
              title="Choose from Files"
              onPress={chooseFromFiles}
            />
          </View>
        ) : null}

        {step === 'restorePassword' ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Backup password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.footerHint}>
              Enter the password used when this backup was created.
            </Text>
            <HousePrimaryButton
              title="Continue"
              disabled={!password}
              onPress={continueRestorePassword}
            />
          </View>
        ) : null}

        {step === 'restoreMode' ? (
          <View style={styles.form}>
            <Text style={styles.sectionLead}>
              How should this backup be applied?
            </Text>
            <HousePrimaryButton
              title="Merge with current data"
              onPress={() => performRestore('merge')}
            />
            <Text style={styles.footerHint}>
              Keep existing restaurants and add or update items from the backup.
            </Text>
            <Pressable
              onPress={confirmOverwrite}
              style={({ pressed }) => [
                styles.destructiveButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.destructiveLabel}>Overwrite current data</Text>
            </Pressable>
            <Text style={styles.footerHint}>
              Replace all restaurants and reviews with the backup.
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
