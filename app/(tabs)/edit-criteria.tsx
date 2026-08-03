import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { houseAlert, houseSaveChangesAlert } from '@/components/ui/HouseAlert';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useKeyboardBottomInset } from '@/hooks/useKeyboardBottomInset';
import {
  STANDARD_CRITERIA,
  isMandatoryStandardCriterion,
  standardCriterionDisplayTitle,
  useCriteriaSettings,
  type CriteriaSettingsSnapshot,
} from '@/context/CriteriaSettings';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

function snapshotKey(snap: CriteriaSettingsSnapshot): string {
  return JSON.stringify({
    d: [...snap.disabledStandardIds].sort(),
  });
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
  const [hydrated, setHydrated] = useState(false);
  const baselineKeyRef = useRef('');
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    if (!ready || hydrated) return;
    const snap = getBackupSnapshot();
    baselineKeyRef.current = snapshotKey(snap);
    setDraftDisabled(new Set(snap.disabledStandardIds));
    setHydrated(true);
  }, [getBackupSnapshot, hydrated, ready]);

  const draftSnapshot = useMemo(
    (): CriteriaSettingsSnapshot => ({
      disabledStandardIds: [...draftDisabled],
      customCriteria: [],
    }),
    [draftDisabled],
  );

  const isDirty = useMemo(() => {
    if (!hydrated) return false;
    return snapshotKey(draftSnapshot) !== baselineKeyRef.current;
  }, [draftSnapshot, hydrated]);

  const enabledCount = useMemo(
    () =>
      STANDARD_CRITERIA.filter((c) => !draftDisabled.has(c.id)).length,
    [draftDisabled],
  );

  const isStandardOn = useCallback(
    (id: string) => !draftDisabled.has(id),
    [draftDisabled],
  );

  const toggleStandard = useCallback(
    (id: string, enabled: boolean) => {
      if (!enabled && isMandatoryStandardCriterion(id)) return;
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

  // edit-criteria is a hidden tab, so router.back() can pop to the wrong tab
  // (Reviews). navigate() to settings matches reviewer-photo / backup-restore.
  const leaveToSettings = useCallback(() => {
    router.navigate('/settings');
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
        titleSize={Theme.navigation.secondaryTitleSize - 4}
        titlePaddingHorizontal={56}
        numberOfLines={2}
        showBack
        onBack={() => {
          if (isDirty) {
            promptDiscard(leaveToSettings);
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
          {STANDARD_CRITERIA.map((criterion, index) => {
            const mandatory = isMandatoryStandardCriterion(criterion.id);
            return (
              <View
                key={criterion.id}
                style={[
                  styles.row,
                  index < STANDARD_CRITERIA.length - 1
                    ? styles.rowBorder
                    : null,
                ]}>
                <Text style={styles.rowTitle}>
                  {standardCriterionDisplayTitle(criterion.id)}
                </Text>
                {mandatory ? (
                  <Text style={styles.requiredLabel}>{t('common.required')}</Text>
                ) : null}
                <GustraSwitch
                  value={isStandardOn(criterion.id)}
                  disabled={mandatory}
                  accessibilityLabel={
                    mandatory
                      ? `${standardCriterionDisplayTitle(criterion.id)}, ${t('common.required')}`
                      : standardCriterionDisplayTitle(criterion.id)
                  }
                  onValueChange={(value) => toggleStandard(criterion.id, value)}
                />
              </View>
            );
          })}
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
  requiredLabel: {
    ...captionTextStyle,
    color: GustraColors.ratingAvoid,
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
