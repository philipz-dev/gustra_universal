import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { REVIEWER_MAX_NAME_LENGTH } from '@/context/ReviewerProfile';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type ShareReviewerNameModalProps = {
  visible: boolean;
  initialName?: string;
  onCancel: () => void;
  onContinue: (name: string) => void;
};

/**
 * Name prompt before sharing (Swift `ShareReviewsButton` reviewerNameSheet).
 */
export function ShareReviewerNameModal({
  visible,
  initialName = '',
  onCancel,
  onContinue,
}: ShareReviewerNameModalProps) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(initialName);

  useEffect(() => {
    if (visible) setDraft(initialName);
  }, [visible, initialName]);

  const trimmed = draft.trim();
  const canContinue = trimmed.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
        <Pressable style={styles.dismissArea} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <SerifText size={22} weight="semibold" style={styles.title}>
            {t('share.nameSheet.title')}
          </SerifText>
          <Text style={styles.footer}>{t('share.nameSheet.body')}</Text>
          <TextInput
            value={draft}
            onChangeText={(text) =>
              setDraft(text.slice(0, REVIEWER_MAX_NAME_LENGTH))
            }
            placeholder={t('share.nameSheet.placeholder')}
            placeholderTextColor="rgba(35, 32, 26, 0.4)"
            style={styles.input}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            maxLength={REVIEWER_MAX_NAME_LENGTH}
            keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canContinue) onContinue(trimmed);
            }}
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('share.nameSheet.cancel')}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.cancelLabel}>
                {t('share.nameSheet.cancel')}
              </Text>
            </Pressable>
            <HousePrimaryButton
              title={t('share.nameSheet.continue')}
              disabled={!canContinue}
              onPress={() => {
                if (canContinue) onContinue(trimmed);
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(35, 32, 26, 0.35)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: GustraColors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(35, 32, 26, 0.18)',
    marginBottom: 4,
  },
  title: {
    color: GustraColors.ink,
  },
  footer: {
    ...bodyTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  input: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  actions: {
    marginTop: 8,
    gap: 10,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  pressed: {
    opacity: 0.7,
  },
});
