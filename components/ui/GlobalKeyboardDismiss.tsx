import { useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

// Same registry ScrollView uses for keyboardShouldPersistTaps hit-testing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TextInputState = require('react-native/Libraries/Components/TextInput/TextInputState')
  .default as {
  isTextInput: (target: unknown) => boolean;
};

function isTextInputTarget(target: GestureResponderEvent['target']): boolean {
  if (target == null) return false;
  try {
    return TextInputState.isTextInput(target);
  } catch {
    return false;
  }
}

/**
 * App-wide “tap outside to dismiss keyboard” — Swift `KeyboardDismiss`.
 *
 * Idle while the keyboard is hidden (capture handler no-ops). Never claims
 * the responder, so buttons still receive the tap. Skips TextInputs so
 * focusing a field does not stutter.
 */
export function GlobalKeyboardDismiss({ children }: { children: ReactNode }) {
  const keyboardVisibleRef = useRef(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onStartShouldSetResponderCapture = (e: GestureResponderEvent) => {
    // Stay completely idle while closed — Swift gestureRecognizerShouldBegin.
    if (!keyboardVisibleRef.current) return false;
    if (isTextInputTarget(e.target)) return false;

    Keyboard.dismiss();
    // Never steal the responder (Swift cancelsTouchesInView = false).
    return false;
  };

  return (
    <View
      style={styles.root}
      onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
