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
  trailing?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  /** Forest-green label (Swift My Gustra toggle). */
  accent?: boolean;
  onPress?: () => void;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Inset-grouped settings row (optional leading icon + chevron / trailing).
 */
export function SettingsRow({
  title,
  subtitle,
  icon,
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
      <View
        style={[
          styles.row,
          pressed ? (listPressedStyle as ViewStyle) : null,
          style,
        ]}>
        {icon ? (
          <View style={styles.iconSlot}>
            <SymbolView
              name={{
                ios: icon.ios,
                android: icon.android,
                web: icon.web ?? icon.android,
              }}
              tintColor={
                destructive
                  ? GustraColors.ratingAvoid
                  : accent
                    ? GustraColors.forestGreen
                    : 'rgba(36, 78, 57, 0.75)'
              }
              size={20}
              weight="medium"
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: Theme.size.hitTarget,
  },
  iconSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.list.separator,
    marginLeft: 16,
  },
  separatorWithIcon: {
    marginLeft: 16 + 28 + 12,
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
