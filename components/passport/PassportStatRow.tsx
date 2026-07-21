import { StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle } from '@/constants/Theme';


type PassportStatRowProps = {
  title: string;
  value: string;
};

export function PassportStatRow({ title, value }: PassportStatRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <SerifText size={17} weight="semibold" style={styles.value}>
        {value}
      </SerifText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: 12,
  },
  title: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
  },

  value: {
    color: GustraColors.forestGreen,
  },
});
