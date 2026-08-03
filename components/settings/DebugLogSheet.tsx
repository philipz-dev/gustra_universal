import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  clearDebugLog,
  formatDebugLogReport,
  getDebugLogEvents,
  type DebugLogSnapshot,
} from '@/services/debug/debugLog';

type DebugLogSheetProps = {
  visible: boolean;
  onClose: () => void;
  snapshot: DebugLogSnapshot;
  onRefresh: () => void;
};

/**
 * Dev-only debug log viewer (hidden Advanced settings). Shows the buffered
 * search/matcher events plus current API counters. Text is selectable so a
 * tester can long-press → copy and paste it back verbatim.
 */
export function DebugLogSheet({
  visible,
  onClose,
  snapshot,
  onRefresh,
}: DebugLogSheetProps) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [refreshTick, setRefreshTick] = useState(0);

  const report = useMemo(() => {
    void refreshTick;
    return formatDebugLogReport(snapshot);
  }, [snapshot, refreshTick]);

  const handleRefresh = () => {
    setRefreshTick((n) => n + 1);
    onRefresh();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <SerifText size={20} weight="semibold" style={styles.title}>
              {t('settings.debugLogTitle')}
            </SerifText>
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleRefresh}
                accessibilityRole="button"
                accessibilityLabel={t('settings.debugLogRefresh')}
                hitSlop={12}
                style={styles.iconBtn}>
                <SymbolView
                  name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                  tintColor={GustraColors.forestGreen}
                  size={20}
                />
              </Pressable>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={12}
                style={styles.iconBtn}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={GustraColors.ink}
                  size={20}
                />
              </Pressable>
            </View>
          </View>

          <Text style={styles.hint}>{t('settings.debugLogHint')}</Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            bounces={false}>
            <View style={styles.logCard}>
              <Text selectable style={styles.logText}>
                {report}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                clearDebugLog();
                handleRefresh();
              }}
              style={({ pressed }) => [
                styles.clearBtn,
                pressed && styles.clearPressed,
              ]}>
              <Text style={styles.clearBtnText}>{t('settings.debugLogClear')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(35, 32, 26, 0.35)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: GustraColors.cream,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 0,
    paddingTop: 10,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(35, 32, 26, 0.2)',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  title: {
    color: GustraColors.ink,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  logCard: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logText: {
    ...bodyTextStyle,
    fontSize: 12,
    lineHeight: 18,
    color: GustraColors.ink,
    fontFamily: 'monospace',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  clearPressed: {
    backgroundColor: 'rgba(36, 78, 57, 0.16)',
  },
  clearBtnText: {
    ...bodyTextStyle,
    fontSize: 15,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
});
