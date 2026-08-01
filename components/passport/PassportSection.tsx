import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

type PassportSectionProps = {
  title: string;
  trailing?: string;
  children: ReactNode;
};

export function PassportSection({ title, trailing, children }: PassportSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        {trailing ? (
          <SerifText size={17} weight="semibold" style={styles.trailing}>
            {trailing}
          </SerifText>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: Theme.typography.sectionHeader,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.55)',
    textTransform: 'none',
  },
  trailing: {
    color: GustraColors.forestGreen,
  },
  body: {
    gap: 6,
  },
});
