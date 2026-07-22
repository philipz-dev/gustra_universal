import { Platform, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';

const SIZE = 30;

/** Clear selected-state mark for nearby / search lists (Swift checkmark.circle.fill). */
export function SelectionCheckmark() {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="checkmark.circle.fill"
        tintColor={GustraColors.forestGreen}
        size={SIZE}
        weight="semibold"
      />
    );
  }

  // Material outline glyphs read faintly on cream — filled circle + white check.
  return (
    <View style={styles.androidBadge} accessibilityElementsHidden>
      <MaterialIcons name="check" color="#FFFFFF" size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  androidBadge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: GustraColors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
