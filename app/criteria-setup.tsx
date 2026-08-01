import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { houseAlert } from '@/components/ui/HouseAlert';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import {
  SERIF_FONT_REGULAR_ITALIC,
  Theme,
  bodyTextStyle,
  captionTextStyle,
  systemSerifFamily,
} from '@/constants/Theme';
import {
  CUSTOM_CRITERION_MAX_NAME_LENGTH,
  STANDARD_CRITERIA,
  isMandatoryStandardCriterion,
  standardCriterionDisplayTitle,
  useCriteriaSettings,
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
 * First-start (and dev replay): brand welcome, then personalize which
 * review criteria matter — including custom criteria.
 */
export default function CriteriaSetupScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardBottomInset();
  const {
    customCriteria,
    isStandardEnabled,
    setStandardEnabled,
    setCustomEnabled,
    addCustomCriterion,
    deleteCustomCriterion,
    hasMinEnabledCriteria,
    completeCriteriaSetup,
  } = useCriteriaSettings();
  const [step, setStep] = useState<'welcome' | 'criteria'>('welcome');
  const [newCustomName, setNewCustomName] = useState('');

  const onFinish = async () => {
    if (!hasMinEnabledCriteria) return;
    Haptics.medium();
    await completeCriteriaSetup();
    router.replace('/(tabs)/(main)');
  };

  const addNew = () => {
    if (!addCustomCriterion(newCustomName)) return;
    Haptics.selectionChanged();
    setNewCustomName('');
  };

  const confirmDelete = (id: string, name: string) => {
    houseAlert(
      t('settings.criteria.deleteTitle'),
      t('settings.criteria.deleteBody', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteCustomCriterion(id),
        },
      ],
    );
  };

  if (step === 'welcome') {
    return <WelcomeStep onContinue={() => setStep('criteria')} />;
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

          {customCriteria.map((criterion) => (
            <Pressable
              key={criterion.id}
              accessibilityRole="switch"
              accessibilityState={{ checked: criterion.isEnabled }}
              onPress={() => {
                Haptics.selectionChanged();
                setCustomEnabled(criterion.id, !criterion.isEnabled);
              }}
              style={[
                styles.row,
                styles.rowBorder,
                criterion.isEnabled && styles.rowOn,
              ]}>
              <CriterionRowIcon id={criterion.id} enabled={criterion.isEnabled} />
              <Text
                style={[
                  styles.rowTitle,
                  criterion.isEnabled && styles.rowTitleOn,
                ]}
                numberOfLines={1}>
                {criterion.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('common.delete')} ${criterion.name}`}
                hitSlop={8}
                onPress={() => confirmDelete(criterion.id, criterion.name)}
                style={({ pressed }) => pressed && styles.pressed}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  tintColor={GustraColors.ratingAvoid}
                  size={20}
                />
              </Pressable>
              <GustraSwitch
                value={criterion.isEnabled}
                onValueChange={(value) =>
                  setCustomEnabled(criterion.id, value)
                }
              />
            </Pressable>
          ))}

          <View style={styles.addRow}>
            <View style={styles.iconWrap}>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="plus"
                  size={16}
                  tintColor="rgba(35, 32, 26, 0.45)"
                  weight="semibold"
                />
              ) : (
                <MaterialIcons
                  name="add"
                  size={20}
                  color="rgba(35, 32, 26, 0.45)"
                />
              )}
            </View>
            <TextInput
              value={newCustomName}
              onChangeText={(text) =>
                setNewCustomName(text.slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH))
              }
              placeholder={t('settings.criteria.custom')}
              placeholderTextColor="rgba(35, 32, 26, 0.4)"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={addNew}
              maxLength={CUSTOM_CRITERION_MAX_NAME_LENGTH}
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            />
            {newCustomName.trim().length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={addNew}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.addLabel}>{t('common.add')}</Text>
              </Pressable>
            ) : null}
          </View>
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 58,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: GustraColors.ink,
    paddingVertical: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
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
  pressed: {
    opacity: 0.7,
  },
});
