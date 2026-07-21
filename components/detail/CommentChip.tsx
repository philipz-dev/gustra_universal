import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

type CommentChipProps = ViewProps & {
  text: string;
};

export function CommentChip({ text, style, ...rest }: CommentChipProps) {
  return (
    <View style={[styles.chip, style]} {...rest}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    padding: 14,
    alignSelf: 'stretch',
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(35, 32, 26, 0.85)',
  },
});
