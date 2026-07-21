import { StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

type FilterSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function FilterSearchBar({
  value,
  onChangeText,
  placeholder = 'Search restaurants or cities',
}: FilterSearchBarProps) {
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
          placeholder={placeholder}
          placeholderTextColor="rgba(35, 32, 26, 0.4)"
          style={styles.input}
          selectionColor={GustraColors.forestGreen}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
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
});
