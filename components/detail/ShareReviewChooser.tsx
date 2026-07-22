import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

export type ShareDestination = 'gustraPackage' | 'email';

type ShareReviewChooserProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (destination: ShareDestination) => void;
};

/**
 * Share destination sheet (Swift `ShareDestinationChooserView`).
 */
export function ShareReviewChooser({
  visible,
  onClose,
  onSelect,
}: ShareReviewChooserProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <SerifText size={22} weight="semibold" style={styles.title}>
              Share
            </SerifText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={12}
              style={styles.closeBtn}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor={GustraColors.ink}
                size={20}
              />
            </Pressable>
          </View>

          <ChooserRow
            title="Share Gustra file"
            subtitle="To import in the Gustra app"
            iosName="doc.badge.arrow.up"
            androidName="upload-file"
            onPress={() => onSelect('gustraPackage')}
          />
          <ChooserRow
            title="Send visual recommendation"
            subtitle="Readable review for email or message"
            iosName="envelope.fill"
            androidName="email"
            onPress={() => onSelect('email')}
          />
        </View>
      </View>
    </Modal>
  );
}

function ChooserRow({
  title,
  subtitle,
  iosName,
  androidName,
  onPress,
}: {
  title: string;
  subtitle: string;
  iosName: string;
  androidName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button">
      <View style={styles.iconCircle}>
        <SymbolView
          name={{
            ios: iosName as never,
            android: androidName as never,
            web: androidName as never,
          }}
          tintColor={GustraColors.forestGreen}
          size={20}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
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
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.lg,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  rowPressed: {
    backgroundColor: 'rgba(36, 78, 57, 0.14)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  rowSubtitle: {
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.6)',
  },
});
