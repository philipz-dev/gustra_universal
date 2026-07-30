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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { bodyTextStyle, Theme } from '@/constants/Theme';

const MAX_LENGTH = 280;

type EmailPersonalMessageModalProps = {
  visible: boolean;
  onCancel: () => void;
  onContinue: (message: string) => void;
};

/**
 * Optional personal message before visual email (Swift ShareReviewsButton message sheet).
 */
export function EmailPersonalMessageModal({
  visible,
  onCancel,
  onContinue,
}: EmailPersonalMessageModalProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) setDraft('');
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismissArea} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.toolbar}>
            <Pressable
              onPress={onCancel}
              hitSlop={12}
              accessibilityLabel="Cancel"
              style={styles.toolButton}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor={GustraColors.ink}
              />
            </Pressable>
            <Pressable
              onPress={() => onContinue(draft)}
              hitSlop={12}
              accessibilityLabel="Continue"
              style={styles.toolButton}>
              <SymbolView
                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                size={20}
                tintColor={GustraColors.forestGreen}
              />
            </Pressable>
          </View>

          <SerifText size={22} weight="semibold" style={styles.title}>
            Personal message
          </SerifText>

          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.slice(0, MAX_LENGTH))}
              placeholder="Optional"
              placeholderTextColor="rgba(35, 32, 26, 0.4)"
              style={styles.input}
              multiline
              maxLength={MAX_LENGTH}
              autoFocus
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
              textAlignVertical="top"
            />
            {draft.length > 0 ? (
              <Pressable
                onPress={() => setDraft('')}
                hitSlop={8}
                accessibilityLabel="Clear"
                style={styles.clear}>
                <SymbolView
                  name={{
                    ios: 'xmark.circle.fill',
                    android: 'cancel',
                    web: 'cancel',
                  }}
                  size={22}
                  tintColor="rgba(35,32,26,0.35)"
                />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.hint}>
            Shown above the review card in the email.
          </Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    minHeight: 280,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toolButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: GustraColors.ink,
    marginBottom: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 88,
    padding: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: GustraColors.bubble,
  },
  input: {
    ...bodyTextStyle,
    flex: 1,
    minHeight: 72,
    fontSize: 17,
    color: GustraColors.ink,
    padding: 0,
  },
  clear: {
    marginTop: 2,
  },
  hint: {
    ...bodyTextStyle,
    marginTop: 12,
    fontSize: 13,
    color: 'rgba(35,32,26,0.55)',
  },
});
