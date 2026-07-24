import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useKeyboardBottomInset } from '@/hooks/useKeyboardBottomInset';
import { useScrollInputIntoView } from '@/hooks/useScrollInputIntoView';
import { Haptics } from '@/services/haptics';
import { resolveCurrentLocation } from '@/services/location/resolveCurrentLocation';
import {
  formatAddressLine,
  formattedDistance,
  makeManualRestaurantDraft,
  regionCodeForCountry,
  restaurantDraftFromResult,
  resultMatchesCountry,
  searchText,
  type RestaurantDraft,
  type RestaurantSearchResult,
} from '@/services/places';
import { useAppTranslation } from '@/hooks/useAppTranslation';

/**
 * Manual restaurant entry (Swift `ManualEntrySelectionView`).
 * Find on Google → pick match, or Continue manually without a map pin.
 */
export default function ManualEntryScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset();
  const { scrollRef, scrollInputIntoView, onScroll } = useScrollInputIntoView();
  const nameRef = useRef<TextInput | null>(null);
  const cityRef = useRef<TextInput | null>(null);
  const countryRef = useRef<TextInput | null>(null);
  const searchGenRef = useRef(0);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [matches, setMatches] = useState<RestaurantSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHighlighted, setSearchHighlighted] = useState(false);

  const trimmedName = name.trim();
  const canProceed = trimmedName.length > 0;
  /** Swift: only after Find on Google returns zero matches. */
  const showContinueManually =
    hasSearched && !isSearching && matches.length === 0 && !searchError;

  const resetSearch = () => {
    searchGenRef.current += 1;
    setHasSearched(false);
    setMatches([]);
    setSearchError(null);
    setIsSearching(false);
  };

  useEffect(() => {
    resetSearch();
    // Reset Google results when name/city/country change (Swift onChange of name/city).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, city, country]);

  const flashSearchButton = () => {
    setSearchHighlighted(true);
    setTimeout(() => setSearchHighlighted(false), 250);
  };

  const startReview = (draft: RestaurantDraft) => {
    Haptics.selectionChanged();
    router.push({
      pathname: '/review-form',
      params: { draft: JSON.stringify(draft) },
    });
  };

  const searchMatches = async () => {
    Keyboard.dismiss();
    const cityTrim = city.trim();
    const countryTrim = country.trim();
    // Include country so Places can resolve "Name · Italy" without a city
    // (without it, a 2 km GPS bias yields random FR/DE hits for common names).
    const query = [trimmedName, cityTrim, countryTrim].filter(Boolean).join(' ');
    if (!query) return;

    flashSearchButton();
    const gen = ++searchGenRef.current;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setMatches([]);

    const location = await resolveCurrentLocation();
    if (gen !== searchGenRef.current) return;

    const countryScoped = Boolean(countryTrim);
    // Local name-only / city search still needs GPS for a useful bias.
    if (!countryScoped && !location.coords) {
      setMatches([]);
      setSearchError(location.error ?? t('alerts.location.unavailable'));
      setIsSearching(false);
      return;
    }

    try {
      const found = await searchText(query, location.coords, {
        locationBias: !countryScoped,
        regionCode: regionCodeForCountry(countryTrim),
        // City present → keep the default nearby bias radius.
        radius: cityTrim ? undefined : 50_000,
      });
      if (gen !== searchGenRef.current) return;
      const filtered = countryTrim
        ? found.filter((match) => resultMatchesCountry(match.country, countryTrim))
        : found;
      setMatches(filtered);
      setIsSearching(false);
    } catch (error) {
      if (gen !== searchGenRef.current) return;
      setMatches([]);
      setSearchError(
        error instanceof Error
          ? error.message
          : t('forms.manual.searchFailed'),
      );
      setIsSearching(false);
    }
  };

  const continueManually = () => {
    const draft = makeManualRestaurantDraft({ name, city, country });
    if (!draft) return;
    startReview(draft);
  };

  const scrollBottomPad =
    keyboardInset > 0
      ? keyboardInset + 24
      : Theme.spacing.floatingTabBarClearance + insets.bottom + 16;
  const footerPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 16;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t("forms.manual.title")}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: scrollBottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        onScroll={onScroll}
        scrollEventThrottle={16}
        overScrollMode="never">
          <View style={styles.group}>
            <ClearableField
              inputRef={nameRef}
              placeholder={t("forms.manual.restaurantName")}
              value={name}
              onChangeText={setName}
              onFocus={() => scrollInputIntoView(nameRef.current)}
              autoFocus
              returnKeyType="next"
            />
            <View style={styles.fieldSep} />
            <ClearableField
              inputRef={cityRef}
              placeholder={t("forms.manual.city")}
              value={city}
              onChangeText={setCity}
              onFocus={() => scrollInputIntoView(cityRef.current)}
              returnKeyType="next"
            />
            <View style={styles.fieldSep} />
            <ClearableField
              inputRef={countryRef}
              placeholder={t("forms.manual.country")}
              value={country}
              onChangeText={setCountry}
              onFocus={() => scrollInputIntoView(countryRef.current)}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("forms.manual.findOnGoogle")}
              disabled={!canProceed || isSearching}
              onPress={() => {
                void searchMatches();
              }}
              style={({ pressed }) => [
                styles.findRow,
                searchHighlighted && styles.findRowHighlighted,
                pressed && canProceed && !isSearching && styles.findRowPressed,
                (!canProceed || isSearching) && styles.findRowDisabled,
              ]}>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="magnifyingglass"
                  size={20}
                  tintColor={
                    searchHighlighted
                      ? '#FFFFFF'
                      : canProceed
                        ? GustraColors.forestGreen
                        : 'rgba(35, 32, 26, 0.35)'
                  }
                />
              ) : (
                <MaterialIcons
                  name="search"
                  size={22}
                  color={
                    searchHighlighted
                      ? '#FFFFFF'
                      : canProceed
                        ? GustraColors.forestGreen
                        : 'rgba(35, 32, 26, 0.35)'
                  }
                />
              )}
              <Text
                style={[
                  styles.findLabel,
                  searchHighlighted && styles.findLabelHighlighted,
                  !canProceed && styles.findLabelDisabled,
                ]}>
                {t('forms.manual.findOnGoogle')}
              </Text>
              {isSearching ? (
                <ActivityIndicator
                  color={
                    searchHighlighted ? '#FFFFFF' : GustraColors.forestGreen
                  }
                />
              ) : null}
            </Pressable>
          </View>
          <Text style={styles.footerHint}>
            {t('forms.manual.searchHint')}
          </Text>

          {isSearching ? (
            <View style={styles.matchesBlock}>
              <Text style={styles.sectionTitle}>{t('forms.manual.googleMatches')}</Text>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={GustraColors.forestGreen} />
                <Text style={styles.loadingText}>{t('forms.manual.loading')}</Text>
              </View>
            </View>
          ) : null}

          {!isSearching && hasSearched ? (
            <View style={styles.matchesBlock}>
              <Text style={styles.sectionTitle}>{t('forms.manual.googleMatches')}</Text>
              {searchError ? (
                <View style={styles.group}>
                  <Text style={styles.errorText}>{searchError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void searchMatches();
                    }}
                    style={({ pressed }) => [
                      styles.tryAgain,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.tryAgainLabel}>{t('common.tryAgain')}</Text>
                  </Pressable>
                </View>
              ) : matches.length === 0 ? (
                <View style={styles.group}>
                  <Text style={styles.emptyText}>{t('forms.manual.noMatch')}</Text>
                </View>
              ) : (
                <View style={styles.group}>
                  {matches.map((match, index) => {
                    const subtitle = formatAddressLine({
                      street: match.streetAddress,
                      city: match.city,
                      country: match.country,
                    });
                    return (
                      <View key={match.id}>
                        {index > 0 ? <View style={styles.fieldSep} /> : null}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            startReview(restaurantDraftFromResult(match))
                          }
                          style={({ pressed }) => [
                            styles.matchRow,
                            pressed && styles.pressed,
                          ]}>
                          <View style={styles.matchCopy}>
                            <Text style={styles.matchTitle}>{match.name}</Text>
                            {subtitle ? (
                              <Text style={styles.matchSubtitle}>
                                {subtitle}
                              </Text>
                            ) : null}
                          </View>
                          {match.distanceMeters != null ? (
                            <Text style={styles.distance}>
                              {formattedDistance(match.distanceMeters)}
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {showContinueManually ? (
          <View style={[styles.manualFooter, { paddingBottom: footerPad }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("forms.manual.continueManually")}
              disabled={!canProceed}
              onPress={continueManually}
              style={({ pressed }) => [
                styles.continueButton,
                !canProceed && styles.continueDisabled,
                pressed && canProceed && styles.pressed,
              ]}>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="square.and.pencil"
                  size={18}
                  tintColor={
                    canProceed
                      ? GustraColors.forestGreen
                      : 'rgba(35, 32, 26, 0.35)'
                  }
                />
              ) : (
                <MaterialIcons
                  name="edit"
                  size={20}
                  color={
                    canProceed
                      ? GustraColors.forestGreen
                      : 'rgba(35, 32, 26, 0.35)'
                  }
                />
              )}
              <Text
                style={[
                  styles.continueLabel,
                  !canProceed && styles.continueLabelDisabled,
                ]}>
                {t('forms.manual.continueManually')}
              </Text>
            </Pressable>
            <Text style={styles.manualHint}>
              {t('forms.manual.manualMapHint')}
            </Text>
          </View>
        ) : null}
    </View>
  );
}

function ClearableField({
  inputRef,
  placeholder,
  value,
  onChangeText,
  onFocus,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
}: {
  inputRef?: RefObject<TextInput | null>;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <View style={styles.fieldRow}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor="rgba(35, 32, 26, 0.4)"
        style={styles.fieldInput}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={({ pressed }) => pressed && styles.pressed}>
          <SymbolView
            name={{
              ios: 'xmark.circle.fill',
              android: 'cancel',
              web: 'cancel',
            }}
            size={22}
            tintColor="rgba(35, 32, 26, 0.35)"
          />
        </Pressable>
      ) : null}
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
    gap: 12,
  },
  group: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 4,
    minHeight: 52,
  },
  fieldInput: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 17,
    color: GustraColors.ink,
    paddingVertical: Platform.OS === 'android' ? 12 : 0,
  },
  fieldSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(35, 32, 26, 0.12)',
    marginLeft: 16,
  },
  findRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  findRowHighlighted: {
    backgroundColor: GustraColors.forestGreen,
  },
  findRowPressed: {
    opacity: 0.85,
  },
  findRowDisabled: {
    opacity: 1,
  },
  findLabel: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: GustraColors.forestGreen,
  },
  findLabelHighlighted: {
    color: '#FFFFFF',
  },
  findLabelDisabled: {
    color: 'rgba(35, 32, 26, 0.35)',
  },
  footerHint: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  matchesBlock: {
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: Theme.radius.lg,
    backgroundColor: 'rgba(236, 227, 207, 0.35)',
  },
  loadingText: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.65)',
  },
  errorText: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  emptyText: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tryAgain: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  tryAgainLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  matchCopy: {
    flex: 1,
    gap: 2,
  },
  matchTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
  },
  matchSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  distance: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  manualFooter: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 12,
    gap: 8,
    backgroundColor: GustraColors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(35, 32, 26, 0.08)',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
  },
  continueDisabled: {
    opacity: 0.55,
  },
  continueLabel: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  continueLabelDisabled: {
    color: 'rgba(35, 32, 26, 0.35)',
  },
  manualHint: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
