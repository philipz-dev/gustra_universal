import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 14,
    overflow: 'hidden',
  },
});
