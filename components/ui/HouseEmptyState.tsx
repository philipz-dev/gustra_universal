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
    | 'person.2'
    | 'line.3.horizontal.decrease'
    | 'magnifyingglass'
    | 'mappin.and.ellipse'
    | 'location.slash'
    | 'square.and.arrow.down'
    | 'clock.arrow.circlepath';
  androidImage?:
    | 'restaurant'
    | 'menu_book'
    | 'map'
    | 'bar_chart'
    | 'settings'
    | 'group'
    | 'filter_list'
    | 'search_off'
    | 'place'
    | 'location_off'
    | 'download'
    | 'history';
  actionTitle?: string;
  onAction?: () => void;
  /** Optional secondary action (e.g. a quieter "browse on map" escape hatch). */
  secondaryActionTitle?: string;
  secondaryOnAction?: () => void;
};

export function HouseEmptyState({
  title,
  description,
  systemImage = 'fork.knife',
  androidImage = 'restaurant',
  actionTitle,
  onAction,
  secondaryActionTitle,
  secondaryOnAction,
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
      {secondaryActionTitle && secondaryOnAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={secondaryOnAction}
          style={({ pressed }) => [styles.secondaryCta, pressed && styles.ctaPressed]}>
          <Text style={styles.secondaryCtaLabel}>{secondaryActionTitle}</Text>
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
  secondaryCta: {
    marginTop: -8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  secondaryCtaLabel: {
    color: GustraColors.forestGreen,
    fontSize: 15,
    fontWeight: '600',
  },
});
