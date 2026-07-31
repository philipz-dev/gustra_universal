import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { houseAlert, houseSaveChangesAlert } from '@/components/ui/HouseAlert';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useKeyboardBottomInset } from '@/hooks/useKeyboardBottomInset';
import {
  CUSTOM_CRITERION_MAX_NAME_LENGTH,
  STANDARD_CRITERIA,
  standardCriterionDisplayTitle,
  useCriteriaSettings,
  type CustomCriterionDefinition,
  type CriteriaSettingsSnapshot,
} from '@/context/CriteriaSettings';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

function snapshotKey(snap: CriteriaSettingsSnapshot): string {
  return JSON.stringify({
    d: [...snap.disabledStandardIds].sort(),
    c: snap.customCriteria.map((x) => ({
      id: x.id,
      name: x.name,
      on: x.isEnabled,
    })),
  });
}

function newCustomId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function EditCriteriaScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardBottomInset();
  const router = useRouter();
  const navigation = useNavigation();
  const { ready, getBackupSnapshot, applyBackupSnapshot } =
    useCriteriaSettings();

  const [draftDisabled, setDraftDisabled] = useState<Set<string>>(
    () => new Set(),
  );
  const [draftCustom, setDraftCustom] = useState<CustomCriterionDefinition[]>(
    [],
  );
  const [newCustomName, setNewCustomName] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const baselineKeyRef = useRef('');
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    if (!ready || hydrated) return;
    const snap = getBackupSnapshot();
    baselineKeyRef.current = snapshotKey(snap);
    setDraftDisabled(new Set(snap.disabledStandardIds));
    setDraftCustom(snap.customCriteria.map((c) => ({ ...c })));
    setHydrated(true);
  }, [getBackupSnapshot, hydrated, ready]);

  const draftSnapshot = useMemo(
    (): CriteriaSettingsSnapshot => ({
      disabledStandardIds: [...draftDisabled],
      customCriteria: draftCustom.map((c) => ({ ...c })),
    }),
    [draftCustom, draftDisabled],
  );

  const isDirty = useMemo(() => {
    if (!hydrated) return false;
    return snapshotKey(draftSnapshot) !== baselineKeyRef.current;
  }, [draftSnapshot, hydrated]);

  const enabledCount = useMemo(() => {
    const standardOn = STANDARD_CRITERIA.filter(
      (c) => !draftDisabled.has(c.id),
    ).length;
    const customOn = draftCustom.filter((c) => c.isEnabled).length;
    return standardOn + customOn;
  }, [draftCustom, draftDisabled]);

  const isStandardOn = useCallback(
    (id: string) => !draftDisabled.has(id),
    [draftDisabled],
  );

  const toggleStandard = useCallback(
    (id: string, enabled: boolean) => {
      if (!enabled && enabledCount <= 1 && isStandardOn(id)) {
        Haptics.warning();
        houseAlert(t('tabs.editCriteria'), t('setup.criteria.minOne'));
        return;
      }
      setDraftDisabled((prev) => {
        const next = new Set(prev);
        if (enabled) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [enabledCount, isStandardOn, t],
  );

  const toggleCustom = useCallback(
    (id: string, enabled: boolean) => {
      const row = draftCustom.find((c) => c.id === id);
      if (!enabled && enabledCount <= 1 && row?.isEnabled) {
        Haptics.warning();
        houseAlert(t('tabs.editCriteria'), t('setup.criteria.minOne'));
        return;
      }
      setDraftCustom((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isEnabled: enabled } : c)),
      );
    },
    [draftCustom, enabledCount, t],
  );

  const addNew = useCallback(() => {
    let trimmed = newCustomName.trim();
    if (!trimmed) return;
    if (trimmed.length > CUSTOM_CRITERION_MAX_NAME_LENGTH) {
      trimmed = trimmed.slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH);
    }
    setDraftCustom((prev) => [
      ...prev,
      { id: newCustomId(), name: trimmed, isEnabled: true },
    ]);
    setNewCustomName('');
  }, [newCustomName]);

  const confirmDelete = useCallback(
    (id: string, name: string) => {
      houseAlert(
        t('settings.criteria.deleteTitle'),
        t('settings.criteria.deleteBody', { name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              const target = draftCustom.find((c) => c.id === id);
              const nextCustom = draftCustom.filter((c) => c.id !== id);
              const nextEnabled =
                STANDARD_CRITERIA.filter((c) => !draftDisabled.has(c.id))
                  .length + nextCustom.filter((c) => c.isEnabled).length;
              if (target?.isEnabled && nextEnabled < 1) {
                Haptics.warning();
                houseAlert(t('tabs.editCriteria'), t('setup.criteria.minOne'));
                return;
              }
              setDraftCustom(nextCustom);
            },
          },
        ],
      );
    },
    [draftCustom, draftDisabled, t],
  );

  const commitAndLeave = useCallback(
    async (onLeave: () => void) => {
      if (enabledCount < 1) {
        Haptics.warning();
        houseAlert(t('tabs.editCriteria'), t('setup.criteria.minOne'));
        return;
      }
      await applyBackupSnapshot(draftSnapshot);
      baselineKeyRef.current = snapshotKey(draftSnapshot);
      Haptics.success();
      allowLeaveRef.current = true;
      onLeave();
    },
    [applyBackupSnapshot, draftSnapshot, enabledCount, t],
  );

  const promptDiscard = useCallback(
    (onLeave: () => void) => {
      Haptics.warning();
      houseSaveChangesAlert({
        title: t('settings.criteria.discardEdits.title'),
        onYes: () => {
          void commitAndLeave(onLeave);
        },
        onNo: () => {
          allowLeaveRef.current = true;
          onLeave();
        },
      });
    },
    [commitAndLeave, t],
  );

  const leaveToSettings = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate('/(tabs)/settings');
  }, [router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !isDirty) return;
      event.preventDefault();
      promptDiscard(() => {
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [isDirty, navigation, promptDiscard]);

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('tabs.editCriteria')}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => {
          if (isDirty) {
            leaveToSettings();
            return;
          }
          allowLeaveRef.current = true;
          leaveToSettings();
        }}
        right={
          isDirty ? (
            <HouseToolbarIconButton
              iosName="checkmark"
              androidName="check"
              accessibilityLabel={t('common.done')}
              onPress={() => {
                void commitAndLeave(leaveToSettings);
              }}
            />
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              (keyboardHeight > 0
                ? keyboardHeight
                : Theme.spacing.floatingTabBarClearance + insets.bottom) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        overScrollMode="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {STANDARD_CRITERIA.map((criterion, index) => (
            <View
              key={criterion.id}
              style={[
                styles.row,
                index < STANDARD_CRITERIA.length - 1 || draftCustom.length > 0
                  ? styles.rowBorder
                  : null,
              ]}>
              <Text style={styles.rowTitle}>
                {standardCriterionDisplayTitle(criterion.id)}
              </Text>
              <GustraSwitch
                value={isStandardOn(criterion.id)}
                onValueChange={(value) => toggleStandard(criterion.id, value)}
              />
            </View>
          ))}

          {draftCustom.map((criterion) => (
            <View key={criterion.id} style={[styles.row, styles.rowBorder]}>
              <Text
                style={[styles.rowTitle, styles.customName]}
                numberOfLines={1}>
                {criterion.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('common.delete')} ${criterion.name}`}
                hitSlop={8}
                onPress={() => confirmDelete(criterion.id, criterion.name)}
                style={({ pressed }) => pressed && styles.pressed}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  tintColor={GustraColors.ratingAvoid}
                  size={20}
                />
              </Pressable>
              <GustraSwitch
                value={criterion.isEnabled}
                onValueChange={(value) => toggleCustom(criterion.id, value)}
              />
            </View>
          ))}

          <View style={styles.addRow}>
            <TextInput
              value={newCustomName}
              onChangeText={(text) =>
                setNewCustomName(text.slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH))
              }
              placeholder={t('settings.criteria.custom')}
              placeholderTextColor="rgba(35, 32, 26, 0.4)"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={addNew}
              maxLength={CUSTOM_CRITERION_MAX_NAME_LENGTH}
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            />
            {newCustomName.trim().length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={addNew}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.addLabel}>{t('common.add')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.footer}>{t('settings.criteria.footer')}</Text>
      </ScrollView>
    </View>
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
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  rowTitle: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
  },
  customName: {
    flexShrink: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
    paddingVertical: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  footer: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
