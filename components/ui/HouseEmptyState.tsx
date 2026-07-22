import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { SerifText } from '@/components/ui/SerifText';

type HouseEmptyStateProps = {
  title: string;
  description: string;
  /** SF Symbol name on iOS */
  systemImage?:
    | 'fork.knife'
    | 'book.closed'
    | 'map'
    | 'chart.bar.doc.horizontal'
    | 'gearshape'
    | 'person.2';
  androidImage?:
    | 'restaurant'
    | 'menu_book'
    | 'map'
    | 'bar_chart'
    | 'settings'
    | 'group';
  actionTitle?: string;
  onAction?: () => void;
};

export function HouseEmptyState({
  title,
  description,
  systemImage = 'fork.knife',
  androidImage = 'restaurant',
  actionTitle,
  onAction,
}: HouseEmptyStateProps) {
  return (
    <View style={styles.container}>
      <SymbolView
        name={{
          ios: systemImage,
          android: androidImage,
          web: androidImage,
        }}
        tintColor={GustraColors.forestGreen}
        size={44}
      />


      <View style={styles.copy}>
        <SerifText size={20} weight="semibold" style={styles.title}>
          {title}
        </SerifText>
        <Text style={styles.description}>{description}</Text>
      </View>
      {actionTitle && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaLabel}>{actionTitle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
    gap: 18,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: GustraColors.ink,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(35, 32, 26, 0.6)',
    textAlign: 'center',
  },
  cta: {
    marginTop: 4,
    backgroundColor: GustraColors.forestGreen,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
