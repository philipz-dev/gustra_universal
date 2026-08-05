import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, SERIF_FONT_REGULAR_ITALIC } from '@/constants/Theme';

type PassportSectionProps = {
  title: string;
  /** Optional cursive kicker above the title (e.g. "your favourites"). */
  kicker?: string;
  trailing?: string;
  children: ReactNode;
};

export function PassportSection({
  title,
  kicker,
  trailing,
  children,
}: PassportSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
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
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217, 162, 39, 0.3)',
  },
  headerCopy: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  kicker: {
    fontFamily: SERIF_FONT_REGULAR_ITALIC,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.5)',
    letterSpacing: -0.2,
  },
  headerTitle: {
    fontSize: Theme.typography.sectionHeader,
    fontWeight: '600',
    color: GustraColors.forestGreen,
    textTransform: 'none',
  },
  trailing: {
    color: GustraColors.forestGreen,
  },
  body: {
    gap: 6,
    paddingTop: 6,
  },
});
