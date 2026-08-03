import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import {
  SERIF_FONT_REGULAR_ITALIC,
  Theme,
  bodyTextStyle,
  captionTextStyle,
  systemSerifFamily,
} from '@/constants/Theme';
import {
  STANDARD_CRITERIA,
  isMandatoryStandardCriterion,
  standardCriterionDisplayTitle,
  useCriteriaSettings,
  QUICK_SETUP_CHOICE,
  ESSENTIALS_SETUP_CHOICE,
  FULL_CONTROL_SETUP_CHOICE,
} from '@/context/CriteriaSettings';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useKeyboardBottomInset } from '@/hooks/useKeyboardBottomInset';
import { Haptics } from '@/services/haptics';
import { criterionIcon } from '@/services/reviews/criterionIcons';

function CriterionRowIcon({ id, enabled }: { id: string; enabled: boolean }) {
  const icons = criterionIcon(id);
  const tint = enabled ? GustraColors.forestGreen : 'rgba(35, 32, 26, 0.45)';
  return (
    <View style={[styles.iconWrap, enabled && styles.iconWrapOn]}>
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={icons.ios}
          size={18}
          tintColor={tint}
          weight="semibold"
        />
      ) : (
        <MaterialIcons name={icons.android} size={20} color={tint} />
      )}
    </View>
  );
}

/** Full-screen brand welcome, shown before the criteria step on first start. */
function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fadeIn, pulse]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('setup.welcome.tapToContinue')}
      style={styles.welcomeScreen}
      onPress={() => {
        Haptics.selectionChanged();
        onContinue();
      }}>
      <Animated.View style={[styles.welcomeCenter, { opacity: fadeIn }]}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.welcomeLogo}
          resizeMode="contain"
        />
        <SerifText size={32} weight="bold" style={styles.welcomeTitle}>
          {t('setup.welcome.title')}
        </SerifText>
        <Text style={styles.welcomeTagline}>creating food memories</Text>
      </Animated.View>
      <Animated.Text
        style={[
          styles.welcomeHint,
          { opacity: pulse, marginBottom: Math.max(insets.bottom, 16) + 28 },
        ]}>
        {t('setup.welcome.tapToContinue')}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Choose-step: pick a starting preset. Quick/Essentials apply fixed criteria
 * and go straight to the app; Full control opens the full criteria screen.
 *
 * Layout (HIG + house style): headline on top (clearing the notch via
 * insets.top), the three options as real house-style buttons (bubble cards,
 * round forest-green icon chips, no chevrons), the recommended preset gets a
 * gold badge + gold border, and the Gustra logo sits at the very bottom.
 */
function ChooseStep({
  onChooseQuick,
  onChooseEssentials,
  onChooseFullControl,
}: {
  onChooseQuick: () => void;
  onChooseEssentials: () => void;
  onChooseFullControl: () => void;
}) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const options: {
    id: string;
    title: string;
    subtitle: string;
    recommended?: boolean;
    icon: { ios: SFSymbol; android: keyof typeof MaterialIcons.glyphMap };
    onPress: () => void;
  }[] = [
    {
      id: 'quick',
      title: t('setup.choose.quick.title'),
      subtitle: t('setup.choose.quick.subtitle'),
      icon: { ios: 'bolt.fill', android: 'bolt' },
      onPress: onChooseQuick,
    },
    {
      id: 'essentials',
      title: t('setup.choose.essentials.title'),
      subtitle: t('setup.choose.essentials.subtitle'),
      recommended: true,
      icon: { ios: 'star.fill', android: 'star' },
      onPress: onChooseEssentials,
    },
    {
      id: 'full',
      title: t('setup.choose.full.title'),
      subtitle: t('setup.choose.full.subtitle'),
      icon: { ios: 'slider.horizontal.3', android: 'tune' },
      onPress: onChooseFullControl,
    },
  ];

  return (
    <View style={styles.chooseScreen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.chooseContent,
          {
            paddingTop: Math.max(insets.top, 16) + 28,
            paddingBottom: Math.max(insets.bottom, 12) + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never">
        <View style={styles.chooseHeadlineWrap}>
          <SerifText size={28} weight="bold" style={styles.chooseHeadline}>
            {t('setup.choose.headline')}
          </SerifText>
          <Text style={styles.chooseBody}>{t('setup.choose.body')}</Text>
        </View>

        <View style={styles.chooseButtons}>
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={
                option.recommended
                  ? `${option.title}, ${t('setup.choose.recommended')}`
                  : option.title
              }
              onPress={() => {
                Haptics.selectionChanged();
                option.onPress();
              }}
              style={({ pressed }) => [
                styles.chooseButton,
                option.recommended && styles.chooseButtonRecommended,
                pressed && styles.chooseButtonPressed,
              ]}>
              <View
                style={[
                  styles.chooseButtonIcon,
                  option.recommended && styles.chooseButtonIconRecommended,
                ]}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name={option.icon.ios}
                    size={22}
                    tintColor="#FFFFFF"
                    weight="semibold"
                  />
                ) : (
                  <MaterialIcons
                    name={option.icon.android}
                    size={24}
                    color="#FFFFFF"
                  />
                )}
              </View>
              <View style={styles.chooseButtonText}>
                <Text style={styles.chooseButtonTitle}>{option.title}</Text>
                <Text style={styles.chooseButtonSubtitle}>
                  {option.subtitle}
                </Text>
              </View>
              {option.recommended ? (
                <View style={styles.chooseRecommendedBadge}>
                  <Text style={styles.chooseRecommendedLabel}>
                    {t('setup.choose.recommended')}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.chooseLogoWrap}>
          <View style={styles.chooseLogoCircle}>
            <Image
              source={require('@/assets/images/splash-icon.png')}
              style={styles.chooseLogo}
              resizeMode="contain"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * First-start (and dev replay): brand welcome, then personalize which
 * review criteria matter — including custom criteria.
 */
export default function CriteriaSetupScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardBottomInset();
  const {
    isStandardEnabled,
    setStandardEnabled,
    hasMinEnabledCriteria,
    completeCriteriaSetup,
    applySetupChoice,
  } = useCriteriaSettings();
  const [step, setStep] = useState<'welcome' | 'choose' | 'criteria'>(
    'welcome',
  );

  const onFinish = async () => {
    if (!hasMinEnabledCriteria) return;
    Haptics.medium();
    await completeCriteriaSetup();
    router.replace('/(tabs)/(main)');
  };

  const onChoose = async (
    choice: typeof QUICK_SETUP_CHOICE,
  ) => {
    Haptics.medium();
    await applySetupChoice(choice);
    if (choice.completeSetup) {
      router.replace('/(tabs)/(main)');
    } else {
      setStep('criteria');
    }
  };

  if (step === 'welcome') {
    return <WelcomeStep onContinue={() => setStep('choose')} />;
  }

  if (step === 'choose') {
    return (
      <ChooseStep
        onChooseQuick={() => void onChoose(QUICK_SETUP_CHOICE)}
        onChooseEssentials={() => void onChoose(ESSENTIALS_SETUP_CHOICE)}
        onChooseFullControl={() => void onChoose(FULL_CONTROL_SETUP_CHOICE)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('setup.criteria.title')}
        titleSize={Theme.navigation.secondaryTitleSize}
        right={
          <HouseToolbarIconButton
            iosName="checkmark"
            androidName="check"
            accessibilityLabel={t('common.done')}
            disabled={!hasMinEnabledCriteria}
            onPress={() => {
              void onFinish();
            }}
          />
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              (keyboardHeight > 0
                ? keyboardHeight
                : Math.max(insets.bottom, 12)) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        overScrollMode="never">
        <View style={styles.hero}>
          <SerifText size={26} weight="bold" style={styles.heroTitle}>
            {t('setup.criteria.headline')}
          </SerifText>
          <Text style={styles.heroBody}>{t('setup.criteria.body')}</Text>
        </View>

        <View style={styles.card}>
          {STANDARD_CRITERIA.map((criterion) => {
            const enabled = isStandardEnabled(criterion.id);
            const mandatory = isMandatoryStandardCriterion(criterion.id);
            return (
              <Pressable
                key={criterion.id}
                accessibilityRole="switch"
                accessibilityLabel={
                  mandatory
                    ? `${standardCriterionDisplayTitle(criterion.id)}, ${t('common.required')}`
                    : standardCriterionDisplayTitle(criterion.id)
                }
                accessibilityState={{ checked: enabled, disabled: mandatory }}
                disabled={mandatory}
                onPress={() => {
                  Haptics.selectionChanged();
                  setStandardEnabled(criterion.id, !enabled);
                }}
                style={[styles.row, styles.rowBorder, enabled && styles.rowOn]}>
                <CriterionRowIcon id={criterion.id} enabled={enabled} />
                <Text
                  style={[styles.rowTitle, enabled && styles.rowTitleOn]}
                  numberOfLines={1}>
                  {standardCriterionDisplayTitle(criterion.id)}
                </Text>
                {mandatory ? (
                  <Text style={styles.requiredLabel}>{t('common.required')}</Text>
                ) : null}
                <GustraSwitch
                  value={enabled}
                  disabled={mandatory}
                  onValueChange={(value) =>
                    setStandardEnabled(criterion.id, value)
                  }
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.hints}>
          <Text style={styles.hint}>{t('setup.criteria.minOne')}</Text>
          <Text style={styles.hint}>
            <Text style={styles.hintTip}>{t('setup.criteria.tip')}</Text>
            {t('setup.criteria.idealThree')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 20,
    gap: 18,
  },
  welcomeScreen: {
    flex: 1,
    // Match splash-icon.png fill so the logo doesn't sit on a slightly different cream.
    backgroundColor: '#F6ECE2',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  welcomeCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 32,
  },
  welcomeLogo: {
    width: 148,
    height: 148,
    marginBottom: 18,
  },
  welcomeTitle: {
    color: GustraColors.forestGreen,
    textAlign: 'center',
  },
  welcomeTagline: {
    // Real italic face (RN does not synthesize italic from upright Source Serif).
    fontFamily: SERIF_FONT_REGULAR_ITALIC || systemSerifFamily,
    fontSize: 18,
    color: 'rgba(35, 32, 26, 0.72)',
    textAlign: 'center',
    marginTop: 2,
  },
  welcomeHint: {
    ...captionTextStyle,
    fontSize: 14,
    letterSpacing: 0.4,
    color: GustraColors.forestGreen,
  },
  hero: {
    gap: 10,
    alignItems: 'flex-start',
  },
  heroTitle: {
    color: GustraColors.forestGreen,
  },
  heroBody: {
    ...bodyTextStyle,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(35, 32, 26, 0.72)',
  },
  card: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 58,
  },
  rowOn: {
    backgroundColor: 'rgba(36, 78, 57, 0.06)',
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(35, 32, 26, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: 'rgba(36, 78, 57, 0.14)',
  },
  rowTitle: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 17,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  rowTitleOn: {
    color: GustraColors.ink,
    fontWeight: '600',
  },
  requiredLabel: {
    ...captionTextStyle,
    color: GustraColors.ratingAvoid,
  },
  hints: {
    gap: 4,
  },
  hint: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 4,
  },
  hintTip: {
    textDecorationLine: 'underline',
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 66,
  },
  choicePressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(36, 78, 57, 0.04)',
  },
  choiceTextWrap: {
    flex: 1,
    gap: 2,
  },
  choiceTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
    fontWeight: '600',
  },
  choiceSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  chooseScreen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  chooseContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },
  chooseLogoWrap: {
    alignItems: 'center',
    paddingTop: 12,
  },
  chooseLogoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    // Match splash-icon.png fill so the logo doesn't sit on a different cream.
    backgroundColor: '#F6ECE2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseLogo: {
    width: 60,
    height: 60,
  },
  chooseButtons: {
    gap: 12,
  },
  chooseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.1)',
  },
  chooseButtonRecommended: {
    borderWidth: 1.5,
    borderColor: GustraColors.gold,
    backgroundColor: 'rgba(217, 162, 39, 0.06)',
  },
  chooseButtonPressed: {
    opacity: 0.82,
  },
  chooseButtonIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: GustraColors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseButtonIconRecommended: {
    backgroundColor: GustraColors.gold,
  },
  chooseButtonText: {
    flex: 1,
    gap: 3,
  },
  chooseButtonTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
    fontWeight: '600',
  },
  chooseRecommendedBadge: {
    backgroundColor: 'rgba(217, 162, 39, 0.16)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  chooseRecommendedLabel: {
    ...captionTextStyle,
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#8A4B12',
    fontWeight: '600',
  },
  chooseButtonSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  chooseHeadlineWrap: {
    alignItems: 'center',
    gap: 8,
  },
  chooseHeadline: {
    color: GustraColors.forestGreen,
    textAlign: 'center',
  },
  chooseBody: {
    ...bodyTextStyle,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(35, 32, 26, 0.65)',
    textAlign: 'center',
    maxWidth: 320,
  },
});
