import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle } from '@/constants/Theme';


type SettingsRowProps = {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  /** Forest-green label (Swift My Gustra toggle). */
  accent?: boolean;
  onPress?: () => void;
  isLast?: boolean;
};

export function SettingsRow({
  title,
  subtitle,
  trailing,
  showChevron = false,
  destructive = false,
  accent = false,
  onPress,
  isLast = false,
}: SettingsRowProps) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.copy}>
        <Text
          style={[
            styles.title,
            destructive && styles.destructive,
            accent && styles.accent,
          ]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {trailing}
      {showChevron ? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          tintColor="rgba(35, 32, 26, 0.35)"
          size={16}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...bodyTextStyle,
    fontSize: 16,
    color: GustraColors.ink,
  },
  subtitle: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },

  destructive: {
    color: GustraColors.ratingAvoid,
  },
  accent: {
    color: GustraColors.forestGreen,
  },
  pressed: {
    opacity: 0.75,
  },
});

