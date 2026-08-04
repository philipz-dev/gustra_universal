import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type AddReviewOption = {
  titleKey: 'forms.addReview.nearby' | 'forms.addReview.mapSearch' | 'forms.addReview.manual';
  subtitleKey:
    | 'forms.addReview.nearbySubtitle'
    | 'forms.addReview.mapSearchSubtitle'
    | 'forms.addReview.manualSubtitle';
  iosName: SFSymbol;
  androidName: keyof typeof MaterialIcons.glyphMap;
  /** Expo Router path when ready; omit for not-yet-wired options. */
  href?: '/nearby-restaurants' | '/map-search' | '/manual-entry';
};

/** Swift `AddReviewView` options. */
const OPTIONS: AddReviewOption[] = [
  {
    titleKey: 'forms.addReview.nearby',
    subtitleKey: 'forms.addReview.nearbySubtitle',
    iosName: 'location',
    androidName: 'location-on',
    href: '/nearby-restaurants',
  },
  {
    titleKey: 'forms.addReview.mapSearch',
    subtitleKey: 'forms.addReview.mapSearchSubtitle',
    iosName: 'map',
    androidName: 'map',
    href: '/map-search',
  },
  {
    titleKey: 'forms.addReview.manual',
    subtitleKey: 'forms.addReview.manualSubtitle',
    iosName: 'square.and.pencil',
    androidName: 'edit',
    href: '/manual-entry',
  },
];

/**
 * New Memory chooser (Swift `AddReviewView`).
 * Pushed from the Memories FAB — three ways to start a new memory.
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
                subtitle={t(option.subtitleKey)}
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
  subtitle,
  option,
  isLast,
  onPress,
}: {
  title: string;
  subtitle: string;
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
      <View style={styles.iconChip}>
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
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
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
    paddingTop: 12,
  },
  group: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.12)',
  },
  pressed: {
    backgroundColor: 'rgba(35, 32, 26, 0.06)',
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(36, 78, 57, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 28,
    textAlign: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
  },
  rowSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
  },
});
