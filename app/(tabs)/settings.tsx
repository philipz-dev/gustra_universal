import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { usePassportDisplaySettings } from '@/context/PassportDisplaySettings';
import {
  REVIEWER_MAX_NAME_LENGTH,
  useReviewerProfile,
} from '@/context/ReviewerProfile';

function comingSoon(label: string) {
  Alert.alert(label, 'Coming soon in a later pass.');
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const nameInputRef = useRef<TextInput>(null);
  const [dataSavings, setDataSavings] = useState(false);
  const {
    categoryAveragesStyle,
    categoryAveragesToggleTitle,
    toggleCategoryAveragesStyle,
  } = usePassportDisplaySettings();
  const { name, photoUri, updateName, ready } = useReviewerProfile();
  const [reviewerNameDraft, setReviewerNameDraft] = useState('');

  useEffect(() => {
    if (!ready) return;
    setReviewerNameDraft(name);
    // Hydrate once when profile loads (avoid resetting draft while typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name only at ready
  }, [ready]);

  const onNameChange = (value: string) => {
    const next =
      value.length > REVIEWER_MAX_NAME_LENGTH
        ? value.slice(0, REVIEWER_MAX_NAME_LENGTH)
        : value;
    setReviewerNameDraft(next);
    // Persist trimmed (Swift `ReviewerProfile.updateName`); keep draft as typed.
    updateName(next);
  };

  const clearName = () => {
    setReviewerNameDraft('');
    updateName('');
    nameInputRef.current?.blur();
    Keyboard.dismiss();
  };


  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
        },
      ]}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <SettingsSection title="Reviewer">
        <View style={styles.reviewerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              photoUri ? 'Edit profile photo' : 'Add profile photo'
            }
            onPress={() => router.push('/reviewer-photo')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <SymbolView
                name={{
                  ios: 'camera.fill',
                  android: 'photo_camera',
                  web: 'photo_camera',
                }}
                tintColor="rgba(36, 78, 57, 0.7)"
                size={26}
              />
            )}
          </Pressable>
          <View style={styles.nameField}>
            <TextInput
              ref={nameInputRef}
              value={reviewerNameDraft}
              onChangeText={onNameChange}
              placeholder="Your name"
              placeholderTextColor="rgba(36, 78, 57, 0.45)"
              style={styles.nameInput}
              accessibilityLabel="Reviewer name"
              maxLength={REVIEWER_MAX_NAME_LENGTH}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => {
                nameInputRef.current?.blur();
                Keyboard.dismiss();
              }}
            />
            {reviewerNameDraft.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear name"
                hitSlop={8}
                onPress={clearName}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{
                    ios: 'xmark.circle.fill',
                    android: 'cancel',
                    web: 'cancel',
                  }}
                  size={22}
                  tintColor="rgba(36, 78, 57, 0.4)"
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </SettingsSection>



      <SettingsSection title="Review criteria">
        <SettingsRow
          title="Edit review criteria"
          showChevron
          isLast
          onPress={() => router.push('/edit-criteria')}

        />
      </SettingsSection>

      <SettingsSection title="My Gustra">
        <SettingsRow
          title={categoryAveragesToggleTitle}
          accent
          isLast
          onPress={toggleCategoryAveragesStyle}
          style={styles.ratingToggleRow}
          trailing={
            <View style={styles.ratingExampleSlot}>
              {categoryAveragesStyle === 'stars' ? (
                <FractionalStarRating score={4} size={24} />
              ) : (
                <SerifText size={20} weight="bold" style={styles.ratingExample}>
                  4/5
                </SerifText>
              )}
            </View>
          }
        />
      </SettingsSection>

      <SettingsSection title="Storage">
        <View style={[styles.rowPad, styles.rowBorder]}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Data savings for photos</Text>
            <Text style={styles.rowSubtitle}>
              {dataSavings ? 'Lower resolution' : 'Higher resolution'}
            </Text>
          </View>
          <GustraSwitch value={dataSavings} onValueChange={setDataSavings} />
        </View>
        <View style={styles.rowPad}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Photos</Text>
            <Text style={styles.rowSubtitle}>12 photos stored locally</Text>
          </View>
          <Text style={styles.secondaryValue}>24.6 MB</Text>
        </View>
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          title="Backup / Restore"
          showChevron
          isLast
          onPress={() => router.push('/backup-restore')}
        />
      </SettingsSection>


      <SettingsSection title="Google API Usage">
        <View style={[styles.apiRow, styles.rowBorder]}>
          <Text style={styles.rowTitle}>Google Maps SDK</Text>
          <SerifText size={15} weight="semibold" style={styles.apiValue}>
            0 today / 0 all-time
          </SerifText>
        </View>
        <View style={[styles.apiRow, styles.rowBorder]}>
          <Text style={styles.rowTitle}>Google Places API</Text>
          <SerifText size={15} weight="semibold" style={styles.apiValue}>
            0 today / 0 all-time
          </SerifText>
        </View>
        <SettingsRow
          title="Reset counters"
          destructive
          isLast
          onPress={() => comingSoon('Reset counters')}
        />
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: 22,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },

  nameField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontFamily: SERIF_FONT,
    fontSize: 17,
    color: GustraColors.forestGreen,
    paddingVertical: 8,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowPad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...bodyTextStyle,
    fontSize: 16,
    color: GustraColors.ink,
  },
  rowSubtitle: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  secondaryValue: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  apiRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  apiValue: {
    color: GustraColors.forestGreen,
  },
  /** Reserve space for the longer “numbers” label so height doesn’t jump. */
  ratingToggleRow: {
    minHeight: 64,
  },
  /** Matches 5×24pt stars + gaps so trailing width stays stable when toggling. */
  ratingExampleSlot: {
    width: 5 * 24 + 4,
    height: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ratingExample: {
    color: GustraColors.forestGreen,
  },
  pressed: {
    opacity: 0.75,
  },
});
