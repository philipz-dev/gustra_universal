import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, captionTextStyle, bodyTextStyle } from '@/constants/Theme';
import { draftAddressLine } from '@/services/places';
import type { RestaurantDraft } from '@/services/places';

type SelectedRestaurantBannerProps = {
  draft: RestaurantDraft;
  actionTitle: string;
  onAction: () => void;
  onClear?: () => void;
};

/** Swift `SelectedRestaurantBanner`. */
export function SelectedRestaurantBanner({
  draft,
  actionTitle,
  onAction,
  onClear,
}: SelectedRestaurantBannerProps) {
  const addressLine = draftAddressLine(draft);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SymbolView
          name={{
            ios: 'checkmark.circle.fill',
            android: 'check_circle',
            web: 'check_circle',
          }}
          tintColor={GustraColors.forestGreen}
          size={28}
        />
        <View style={styles.copy}>
          <Text style={styles.caption}>Selected Restaurant</Text>
          <SerifText size={17} weight="semibold" style={styles.name}>
            {draft.name}
          </SerifText>
          {addressLine ? (
            <Text style={styles.address}>{addressLine}</Text>
          ) : null}
        </View>
        {onClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deselect restaurant"
            hitSlop={8}
            onPress={onClear}
            style={({ pressed }) => pressed && styles.pressed}>
            <SymbolView
              name={{
                ios: 'xmark.circle.fill',
                android: 'cancel',
                web: 'cancel',
              }}
              tintColor="rgba(35, 32, 26, 0.35)"
              size={28}
            />
          </Pressable>
        ) : null}
      </View>

      <HousePrimaryButton title={actionTitle} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xl,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  caption: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  name: {
    color: GustraColors.ink,
  },
  address: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  pressed: {
    opacity: 0.7,
  },
});
