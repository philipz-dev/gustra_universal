import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInput,
} from 'react-native';

/** Match Swift `scrollCommentIntoView` delay after focus (keyboard animation). */
const FOCUS_DELAY_MS = Platform.OS === 'ios' ? 300 : 140;
/** Gap between input bottom and keyboard top. */
const KEYBOARD_GAP = 48;

/**
 * Keeps the focused TextInput visible above the keyboard inside a ScrollView
 * (Swift `ReviewFormView.scrollCommentIntoView` / CommentField keep-visible).
 *
 * Uses window coordinates + live keyboard height so RNGH/RN ScrollViews both work.
 * Expose `keyboardHeight` so callers can grow `contentContainerStyle.paddingBottom`
 * — without that, there often isn’t enough room to scroll the field clear.
 */
export function useScrollInputIntoView() {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const focusedInputRef = useRef<TextInput | null>(null);
  const keyboardHeightRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const performScroll = useCallback((input: TextInput) => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    input.measureInWindow((_ix, iy, _iw, ih) => {
      const windowH = Dimensions.get('window').height;
      const keyboardH = keyboardHeightRef.current;
      // When Android resize shrinks the window, keyboard height may be 0 —
      // still keep a comfortable margin from the visible bottom.
      const visibleBottom =
        keyboardH > 0 ? windowH - keyboardH : windowH - 12;
      const inputBottom = iy + ih;
      const overlap = inputBottom + KEYBOARD_GAP - visibleBottom;
      if (overlap <= 0) return;
      scroll.scrollTo({
        y: Math.max(0, scrollYRef.current + overlap),
        animated: true,
      });
    });
  }, []);

  const scrollInputIntoView = useCallback(
    (input: TextInput | null, delayMs: number = FOCUS_DELAY_MS) => {
      if (!input) return;
      focusedInputRef.current = input;
      clearTimer();

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const current = focusedInputRef.current;
        if (!current) return;
        performScroll(current);
      }, delayMs);
    },
    [performScroll],
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates.height;
      keyboardHeightRef.current = height;
      setKeyboardHeight(height);
      const focused = focusedInputRef.current;
      if (focused) {
        // Re-run after padding reflow + keyboard frame settle.
        clearTimer();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (focusedInputRef.current) {
            performScroll(focusedInputRef.current);
          }
        }, Platform.OS === 'ios' ? 80 : 120);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    });

    return () => {
      clearTimer();
      showSub.remove();
      hideSub.remove();
    };
  }, [performScroll]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const clearFocusedInput = useCallback(() => {
    focusedInputRef.current = null;
  }, []);

  return {
    scrollRef,
    scrollYRef,
    keyboardHeight,
    scrollInputIntoView,
    onScroll,
    clearFocusedInput,
  };
}
