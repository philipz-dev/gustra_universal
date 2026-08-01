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
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import {
  bodyTextStyle,
  captionTextStyle,
  listPressedStyle,
  Theme,
} from '@/constants/Theme';

export type SettingsRowIcon = {
  ios: SFSymbol;
  android: AndroidSymbol;
  web?: AndroidSymbol;
};

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  /** Leading SF / Material symbol (house settings list). */
  icon?: SettingsRowIcon;
  /** Icon chip accent: default forest, `accent` gold, `destructive` red. */
  iconTint?: 'default' | 'accent' | 'destructive';
  trailing?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  /** Forest-green label (Swift My Gustra toggle). */
  accent?: boolean;
  onPress?: () => void;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
};

const iconChipStyle = {
  default: {
    backgroundColor: 'rgba(36, 78, 57, 0.1)',
    color: GustraColors.forestGreen,
  },
  accent: {
    backgroundColor: 'rgba(217, 162, 39, 0.16)',
    color: GustraColors.gold,
  },
  destructive: {
    backgroundColor: 'rgba(199, 71, 66, 0.12)',
    color: GustraColors.ratingAvoid,
  },
} as const;

/**
 * Inset-grouped settings row with a tinted icon chip (iOS Settings look).
 */
export function SettingsRow({
  title,
  subtitle,
  icon,
  iconTint = 'default',
  trailing,
  showChevron = false,
  destructive = false,
  accent = false,
  onPress,
  isLast = false,
  style,
}: SettingsRowProps) {
  const chip =
    iconTint === 'destructive' || destructive
      ? iconChipStyle.destructive
      : iconTint === 'accent'
        ? iconChipStyle.accent
        : iconChipStyle.default;

  const row = (pressed: boolean) => (
    <>
      <View
        style={[
          styles.row,
          pressed ? (listPressedStyle as ViewStyle) : null,
          style,
        ]}>
        {icon ? (
          <View style={[styles.iconChip, { backgroundColor: chip.backgroundColor }]}>
            <SymbolView
              name={{
                ios: icon.ios,
                android: icon.android,
                web: icon.web ?? icon.android,
              }}
              tintColor={chip.color}
              size={17}
              weight="semibold"
            />
          </View>
        ) : null}
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
      {!isLast ? (
        <View
          style={[styles.separator, icon ? styles.separatorWithIcon : null]}
        />
      ) : null}
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
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: Platform.OS === 'android' ? 48 : 52,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: Theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.list.separator,
    marginLeft: 16,
  },
  separatorWithIcon: {
    marginLeft: 16 + 30 + 12,
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
