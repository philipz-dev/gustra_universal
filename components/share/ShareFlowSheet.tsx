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

import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { REVIEWER_MAX_NAME_LENGTH } from '@/context/ReviewerProfile';
import type { ShareDestination } from '@/components/detail/ShareReviewChooser';
import { useAppTranslation } from '@/hooks/useAppTranslation';

const MESSAGE_MAX = 280;

export type ShareFlowStep = 'chooser' | 'name' | 'message';

type ShareFlowSheetProps = {
  visible: boolean;
  step: ShareFlowStep;
  initialName?: string;
  onClose: () => void;
  onSelectDestination: (destination: ShareDestination) => void;
  onNameContinue: (name: string) => void;
  onMessageContinue: (message: string) => void;
};

/**
 * Single Modal for share destination → name → personal message.
 * Keeps the sheet up between steps so iOS does not flash the review behind.
 */
export function ShareFlowSheet({
  visible,
  step,
  initialName = '',
  onClose,
  onSelectDestination,
  onNameContinue,
  onMessageContinue,
}: ShareFlowSheetProps) {
  const insets = useSafeAreaInsets();
  const [nameDraft, setNameDraft] = useState(initialName);
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (step === 'name') setNameDraft(initialName);
    if (step === 'message') setMessageDraft('');
  }, [visible, step, initialName]);

  const nameTrimmed = nameDraft.trim();
  const canContinueName = nameTrimmed.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handle} />

          {step === 'chooser' ? (
            <ChooserStep
              onClose={onClose}
              onSelect={onSelectDestination}
            />
          ) : null}

          {step === 'name' ? (
            <NameStep
              draft={nameDraft}
              onChangeDraft={setNameDraft}
              canContinue={canContinueName}
              onCancel={onClose}
              onContinue={() => {
                if (canContinueName) onNameContinue(nameTrimmed);
              }}
            />
          ) : null}

          {step === 'message' ? (
            <MessageStep
              draft={messageDraft}
              onChangeDraft={setMessageDraft}
              onCancel={onClose}
              onContinue={() => onMessageContinue(messageDraft)}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChooserStep({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (destination: ShareDestination) => void;
}) {
  const { t } = useAppTranslation();
  return (
    <>
      <View style={styles.header}>
        <SerifText size={22} weight="semibold" style={styles.title}>
          {t('common.share')}
        </SerifText>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          hitSlop={12}
          style={styles.iconButton}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            tintColor={GustraColors.ink}
            size={20}
          />
        </Pressable>
      </View>

      <ChooserRow
        title={t('share.chooser.gustraFile')}
        subtitle={t('share.chooser.gustraFileSubtitle')}
        iosName="doc.badge.arrow.up"
        androidName="upload-file"
        onPress={() => onSelect('gustraPackage')}
      />
      <ChooserRow
        title={t('share.chooser.visual')}
        subtitle={t('share.chooser.visualSubtitle')}
        iosName="envelope.fill"
        androidName="email"
        onPress={() => onSelect('email')}
      />
    </>
  );
}

function NameStep({
  draft,
  onChangeDraft,
  canContinue,
  onCancel,
  onContinue,
}: {
  draft: string;
  onChangeDraft: (value: string) => void;
  canContinue: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <SerifText size={22} weight="semibold" style={styles.title}>
        Your name
      </SerifText>
      <Text style={styles.hint}>
        Your name is included when you share reviews.
      </Text>
      <TextInput
        value={draft}
        onChangeText={(text) =>
          onChangeDraft(text.slice(0, REVIEWER_MAX_NAME_LENGTH))
        }
        placeholder="Reviewer name"
        placeholderTextColor="rgba(35, 32, 26, 0.4)"
        style={styles.input}
        autoFocus
        autoCorrect={false}
        autoCapitalize="words"
        maxLength={REVIEWER_MAX_NAME_LENGTH}
        keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canContinue) onContinue();
        }}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <HousePrimaryButton
          title="Continue"
          disabled={!canContinue}
          onPress={onContinue}
        />
      </View>
    </>
  );
}

function MessageStep({
  draft,
  onChangeDraft,
  onCancel,
  onContinue,
}: {
  draft: string;
  onChangeDraft: (value: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <View style={styles.toolbar}>
        <Pressable
          onPress={onCancel}
          hitSlop={12}
          accessibilityLabel="Cancel"
          style={styles.iconButton}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={18}
            tintColor={GustraColors.ink}
          />
        </Pressable>
        <Pressable
          onPress={onContinue}
          hitSlop={12}
          accessibilityLabel="Continue"
          style={styles.iconButton}>
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
          onChangeText={(text) => onChangeDraft(text.slice(0, MESSAGE_MAX))}
          placeholder="Optional"
          placeholderTextColor="rgba(35, 32, 26, 0.4)"
          style={styles.messageInput}
          multiline
          maxLength={MESSAGE_MAX}
          autoFocus
          keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
          textAlignVertical="top"
        />
        {draft.length > 0 ? (
          <Pressable
            onPress={() => onChangeDraft('')}
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
    </>
  );
}

function ChooserRow({
  title,
  subtitle,
  iosName,
  androidName,
  onPress,
}: {
  title: string;
  subtitle: string;
  iosName: string;
  androidName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button">
      <View style={styles.iconCircle}>
        <SymbolView
          name={{
            ios: iosName as never,
            android: androidName as never,
            web: androidName as never,
          }}
          tintColor={GustraColors.forestGreen}
          size={20}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
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
    paddingTop: 10,
    gap: 12,
    minHeight: 280,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(35, 32, 26, 0.18)',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: GustraColors.ink,
  },
  hint: {
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 88,
    padding: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: GustraColors.bubble,
  },
  messageInput: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.lg,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  rowPressed: {
    backgroundColor: 'rgba(36, 78, 57, 0.14)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  rowSubtitle: {
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.6)',
  },
});
