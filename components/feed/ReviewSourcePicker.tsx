import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle } from '@/constants/Theme';
import type { ReviewOrigin } from '@/data/types';

const OPTIONS: { value: ReviewOrigin; label: string }[] = [
  { value: 'own', label: 'My reviews' },
  { value: 'imported', label: "Friends' reviews" },
];

type ReviewSourcePickerProps = {
  value: ReviewOrigin;
  onChange: (value: ReviewOrigin) => void;
};

/** Segmented My / Friends control (Swift `reviewSourcePicker`). */
export function ReviewSourcePicker({ value, onChange }: ReviewSourcePickerProps) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <View style={styles.track}>
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}>
              <Text
                style={[styles.label, selected && styles.labelSelected]}
                numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
    backgroundColor: GustraColors.cream,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: GustraColors.bubble,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentSelected: {
    backgroundColor: GustraColors.forestGreen,
  },
  label: {
    ...bodyTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
