import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { captionTextStyle, Surface, Theme } from '@/constants/Theme';

type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
};

/** Inset-grouped settings block (Swift `List` / Form section). */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title.toUpperCase()}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  title: {
    ...captionTextStyle,
    fontSize: Theme.list.sectionHeaderSize,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.5)',
    paddingHorizontal: 16,
    letterSpacing: Platform.OS === 'ios' ? 0.4 : 0.6,
  },
  card: {
    backgroundColor: Theme.list.cardBackground,
    borderRadius: Theme.radius.lg,
    // iOS: clip elevation. Android: overflow+radius without elevation can
    // blank child Text/controls — keep visible and flat (matches iOS look).
    ...(Platform.OS === 'ios'
      ? { overflow: 'hidden' as const, ...Surface.raised }
      : { overflow: 'visible' as const, ...Surface.flat }),
  },
});
