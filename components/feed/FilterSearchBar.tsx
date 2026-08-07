import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type FilterSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function FilterSearchBar({
  value,
  onChangeText,
  placeholder,
}: FilterSearchBarProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          tintColor={GustraColors.forestGreen}
          size={18}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? t('reviews.searchPlaceholder')}
          placeholderTextColor="rgba(35, 32, 26, 0.4)"
          style={styles.input}
          selectionColor={GustraColors.forestGreen}
          keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
          autoCorrect={false}
          returnKeyType="search"
        />
        {value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.clear')}
            hitSlop={8}
            onPress={() => onChangeText('')}
            style={({ pressed }) => pressed && styles.clearPressed}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
              tintColor="rgba(35, 32, 26, 0.35)"
              size={18}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Theme.spacing.searchHorizontal,
    paddingVertical: Theme.spacing.searchVertical,
    backgroundColor: GustraColors.cream,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
    padding: 0,
  },
  clearPressed: {
    opacity: 0.5,
  },
});
