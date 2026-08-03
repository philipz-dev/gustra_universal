import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type AddReviewOption = {
  titleKey: 'forms.addReview.nearby' | 'forms.addReview.mapSearch' | 'forms.addReview.manual';
  iosName: SFSymbol;
  androidName: keyof typeof MaterialIcons.glyphMap;
  /** Expo Router path when ready; omit for not-yet-wired options. */
  href?: '/nearby-restaurants' | '/map-search' | '/manual-entry';
};

/** Swift `AddReviewView` options. */
const OPTIONS: AddReviewOption[] = [
  {
    titleKey: 'forms.addReview.nearby',
    iosName: 'location',
    androidName: 'location-on',
    href: '/nearby-restaurants',
  },
  {
    titleKey: 'forms.addReview.mapSearch',
    iosName: 'map',
    androidName: 'map',
    href: '/map-search',
  },
  {
    titleKey: 'forms.addReview.manual',
    iosName: 'square.and.pencil',
    androidName: 'edit',
    href: '/manual-entry',
  },
];

/**
 * Add Review chooser (Swift `AddReviewView`).
 * Pushed from the Reviews FAB — three entry paths, no behavior yet.
 */
export default function AddReviewScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('forms.addReview.title')}
        titleSize={Theme.navigation.secondaryTitleSize}
        titlePaddingHorizontal={56}
        showBack
        onBack={() => router.back()}
      />

      <View
        style={[
          styles.content,
          {
            paddingBottom:
              Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
          },
        ]}>
        <View style={styles.group}>
          {OPTIONS.map((option, index) => {
            const title = t(option.titleKey);
            return (
              <AddReviewRow
                key={option.titleKey}
                title={title}
                option={option}
                isLast={index === OPTIONS.length - 1}
                onPress={() => {
                  if (option.href) {
                    router.push(option.href);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function AddReviewRow({
  title,
  option,
  isLast,
  onPress,
}: {
  title: string;
  option: AddReviewOption;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        pressed && styles.pressed,
      ]}>
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={option.iosName}
          tintColor={GustraColors.forestGreen}
          size={22}
          style={styles.icon}
        />
      ) : (
        <MaterialIcons
          name={option.androidName}
          color={GustraColors.forestGreen}
          size={22}
          style={styles.icon}
        />
      )}
      <Text style={styles.rowTitle}>{title}</Text>
      {Platform.OS === 'ios' ? (
        <SymbolView
          name="chevron.right"
          tintColor="rgba(35, 32, 26, 0.35)"
          size={16}
        />
      ) : (
        <MaterialIcons
          name="chevron-right"
          color="rgba(35, 32, 26, 0.35)"
          size={16}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 20,
  },
  group: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.12)',
  },
  pressed: {
    backgroundColor: 'rgba(35, 32, 26, 0.06)',
  },
  icon: {
    width: 28,
    textAlign: 'center',
  },
  rowTitle: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 17,
    color: GustraColors.ink,
  },
});
