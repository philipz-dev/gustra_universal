import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import {
  bodyTextStyle,
  captionTextStyle,
  listPressedStyle,
  Theme,
} from '@/constants/Theme';

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
  style?: StyleProp<ViewStyle>;
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
  style,
}: SettingsRowProps) {
  const row = (pressed: boolean) => (
    <>
      <View style={[styles.row, pressed && listPressedStyle, style]}>
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
            name={{
              ios: 'chevron.right',
              android: 'chevron_right',
              web: 'chevron_right',
            }}
            tintColor="rgba(35, 32, 26, 0.35)"
            size={16}
          />
        ) : null}
      </View>
      {!isLast ? <View style={styles.separator} /> : null}
    </>
  );

  if (!onPress) return row(false);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={
        Platform.OS === 'android'
          ? { color: Theme.list.androidRipple }
          : undefined
      }>
      {({ pressed }) => row(Platform.OS === 'ios' ? pressed : false)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: Theme.size.hitTarget,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.list.separator,
    marginLeft: 16,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
  },
  subtitle: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  destructive: {
    color: GustraColors.ratingAvoid,
  },
  accent: {
    color: GustraColors.forestGreen,
  },
});
