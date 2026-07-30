import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { captionTextStyle, Surface, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';

type SettingsCollapsibleSectionProps = {
  title: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  accessibilityExpandLabel: string;
  accessibilityCollapseLabel: string;
  children: ReactNode;
};

/**
 * Tappable section header that reveals an inset settings card (Advanced, etc.).
 */
export function SettingsCollapsibleSection({
  title,
  expanded,
  onExpandedChange,
  accessibilityExpandLabel,
  accessibilityCollapseLabel,
  children,
}: SettingsCollapsibleSectionProps) {
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded ? accessibilityCollapseLabel : accessibilityExpandLabel
        }
        onPress={() => {
          Haptics.selectionChanged();
          onExpandedChange(!expanded);
        }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <SymbolView
          name={{
            ios: expanded ? 'chevron.up' : 'chevron.down',
            android: expanded ? 'expand_less' : 'expand_more',
            web: expanded ? 'expand_less' : 'expand_more',
          }}
          tintColor="rgba(35, 32, 26, 0.45)"
          size={18}
          weight="semibold"
        />
      </Pressable>
      {expanded ? (
        <View style={styles.card as ViewStyle}>{children}</View>
      ) : null}
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
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: Theme.size.hitTarget - 8,
  },
  title: {
    ...captionTextStyle,
    fontSize: Theme.list.sectionHeaderSize,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.5)',
    letterSpacing: Platform.OS === 'ios' ? 0.4 : 0.6,
  },
  card: {
    backgroundColor: Theme.list.cardBackground,
    borderRadius: Theme.radius.lg,
    ...(Platform.OS === 'ios'
      ? { overflow: 'hidden' as const, ...Surface.raised }
      : { overflow: 'visible' as const, ...Surface.flat }),
  },
  pressed: {
    opacity: 0.7,
  },
});
