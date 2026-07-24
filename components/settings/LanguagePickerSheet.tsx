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
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  APP_LANGUAGES,
  type AppLanguage,
  type LanguagePreference,
} from '@/i18n/resolveLanguage';

type LanguagePickerSheetProps = {
  visible: boolean;
  selected: LanguagePreference;
  onClose: () => void;
  onSelect: (preference: LanguagePreference) => void;
};

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  de: 'settings.languageGerman',
  en: 'settings.languageEnglish',
  es: 'settings.languageSpanish',
  fr: 'settings.languageFrench',
  it: 'settings.languageItalian',
  nl: 'settings.languageDutch',
};

/**
 * Settings language picker: System in its own group, then languages A–Z
 * in an iOS-style inset grouped list.
 */
export function LanguagePickerSheet({
  visible,
  selected,
  onClose,
  onSelect,
}: LanguagePickerSheetProps) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const pick = (preference: LanguagePreference) => {
    onSelect(preference);
    onClose();
  };

  const languageRows: { key: LanguagePreference; label: string }[] =
    APP_LANGUAGES.map((code) => ({
      key: code,
      label: t(LANGUAGE_LABEL_KEY[code]),
    }));

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
            <SerifText size={22} weight="semibold" style={styles.title}>
              {t('settings.languagePickerTitle')}
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

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <InsetGroup
              rows={[
                {
                  key: 'system',
                  label: t('settings.languageSystem'),
                },
              ]}
              selected={selected}
              onPick={pick}
            />
            <InsetGroup
              rows={languageRows}
              selected={selected}
              onPick={pick}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InsetGroup({
  rows,
  selected,
  onPick,
}: {
  rows: { key: LanguagePreference; label: string }[];
  selected: LanguagePreference;
  onPick: (preference: LanguagePreference) => void;
}) {
  return (
    <View style={styles.group}>
      {rows.map((row, index) => {
        const isSelected = selected === row.key;
        const isLast = index === rows.length - 1;
        return (
          <Pressable
            key={row.key}
            onPress={() => onPick(row.key)}
            style={({ pressed }) => [
              styles.row,
              !isLast && styles.rowBorder,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={row.label}>
            <Text
              style={[styles.label, isSelected && styles.labelSelected]}>
              {row.label}
            </Text>
            {isSelected ? (
              <SymbolView
                name={{
                  ios: 'checkmark',
                  android: 'check',
                  web: 'check',
                }}
                tintColor={GustraColors.forestGreen}
                size={18}
                weight="semibold"
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
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
    maxHeight: '70%',
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
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 16,
    paddingBottom: 8,
  },
  group: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  label: {
    flex: 1,
    fontSize: 17,
    color: GustraColors.ink,
  },
  labelSelected: {
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  pressed: {
    backgroundColor: 'rgba(35, 32, 26, 0.05)',
  },
});
