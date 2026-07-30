import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { useAppTranslation } from '@/hooks/useAppTranslation';

export type ReviewOptionsAction =
  | 'recordVisit'
  | 'edit'
  | 'shareGustra'
  | 'shareVisual';

type ReviewOptionsSheetProps = {
  visible: boolean;
  /** Friend/imported review — Edit is disabled with explanation. */
  isFriendReview?: boolean;
  onClose: () => void;
  onAction: (action: ReviewOptionsAction) => void;
};

/**
 * Review detail overflow menu (⋯ → Options sheet).
 * Visit/Edit · Share. Delete lives on Edit review / feed swipe.
 */
export function ReviewOptionsSheet({
  visible,
  isFriendReview = false,
  onClose,
  onAction,
}: ReviewOptionsSheetProps) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <SerifText size={22} weight="semibold" style={styles.title}>
              {t('detail.options.title')}
            </SerifText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={12}
              style={styles.closeBtn}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor={GustraColors.ink}
                size={20}
              />
            </Pressable>
          </View>

          <View style={styles.groups}>
            <InsetGroup>
              <OptionRow
                title={t('detail.options.recordVisit')}
                iosName="plus.circle"
                androidName="add_circle"
                showBorder
                onPress={() => onAction('recordVisit')}
              />
              <OptionRow
                title={t('detail.options.editReview')}
                subtitle={
                  isFriendReview
                    ? t('detail.options.cannotEditFriend')
                    : undefined
                }
                iosName="pencil"
                androidName="edit"
                disabled={isFriendReview}
                onPress={() => onAction('edit')}
              />
            </InsetGroup>

            <View style={styles.shareBlock}>
              <Text style={styles.groupLabel}>
                {t('detail.options.shareSection')}
              </Text>
              <InsetGroup>
                <OptionRow
                  title={t('share.chooser.gustraFile')}
                  subtitle={t('share.chooser.gustraFileSubtitle')}
                  iosName="doc.badge.arrow.up"
                  androidName="upload_file"
                  showBorder
                  onPress={() => onAction('shareGustra')}
                />
                <OptionRow
                  title={t('share.chooser.visual')}
                  subtitle={t('share.chooser.visualSubtitle')}
                  iosName="envelope.fill"
                  androidName="email"
                  onPress={() => onAction('shareVisual')}
                />
              </InsetGroup>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InsetGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function OptionRow({
  title,
  subtitle,
  iosName,
  androidName,
  disabled = false,
  showBorder = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  iosName: string;
  androidName: string;
  disabled?: boolean;
  showBorder?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        showBorder && styles.rowBorder,
        disabled && styles.rowDisabled,
        !disabled && pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}>
      <View style={[styles.iconCircle, disabled && styles.iconCircleDisabled]}>
        <SymbolView
          name={{
            ios: iosName as never,
            android: androidName as never,
            web: androidName as never,
          }}
          tintColor={
            disabled ? 'rgba(35, 32, 26, 0.28)' : GustraColors.forestGreen
          }
          size={20}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, disabled && styles.rowTitleDisabled]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </Pressable>
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
    paddingTop: 10,
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
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  title: {
    color: GustraColors.ink,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groups: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  shareBlock: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: 'rgba(35, 32, 26, 0.5)',
    paddingHorizontal: 4,
  },
  group: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  pressed: {
    backgroundColor: 'rgba(35, 32, 26, 0.05)',
  },
  rowDisabled: {
    opacity: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDisabled: {
    backgroundColor: 'rgba(35, 32, 26, 0.06)',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: GustraColors.ink,
  },
  rowTitleDisabled: {
    color: 'rgba(35, 32, 26, 0.38)',
  },
  rowSubtitle: {
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
});
