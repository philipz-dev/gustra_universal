import { useCallback, useEffect, useRef } from 'react';
import {
  findNodeHandle,
  Platform,
  type ScrollView,
  type TextInput,
} from 'react-native';

/** Match Swift `scrollCommentIntoView` delay after focus (keyboard animation). */
const FOCUS_DELAY_MS = Platform.OS === 'ios' ? 280 : 120;
/** Extra gap between input bottom and keyboard top (Swift ~0.72 anchor). */
const KEYBOARD_GAP = 72;

type Scrollable = ScrollView & {
  getScrollResponder?: () => {
    scrollResponderScrollNativeHandleToKeyboard?: (
      nodeHandle: number,
      additionalOffset: number,
      preventNegativeScrolling?: boolean,
    ) => void;
  };
};

/**
 * Keeps the focused TextInput visible above the keyboard inside a ScrollView
 * (Swift `ReviewFormView.scrollCommentIntoView` / CommentField keep-visible).
 */
export function useScrollInputIntoView() {
  const scrollRef = useRef<ScrollView | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scrollInputIntoView = useCallback(
    (input: TextInput | null, delayMs: number = FOCUS_DELAY_MS) => {
      if (!input) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const scroll = scrollRef.current as Scrollable | null;
        if (!scroll) return;

        const nodeHandle = findNodeHandle(input);
        if (nodeHandle == null) return;

        const responder = scroll.getScrollResponder?.() ?? (scroll as Scrollable);
        const scrollToKeyboard =
          responder.scrollResponderScrollNativeHandleToKeyboard;

        if (typeof scrollToKeyboard === 'function') {
          scrollToKeyboard(nodeHandle, KEYBOARD_GAP, true);
          return;
        }

        // Fallback when the native scroll responder API is unavailable.
        const scrollHandle = findNodeHandle(scroll);
        if (scrollHandle == null) return;
        input.measureLayout(
          scrollHandle,
          (_x, y, _w, height) => {
            const targetY = Math.max(0, y + height - KEYBOARD_GAP * 2);
            scroll.scrollTo({ y: targetY, animated: true });
          },
          () => {
            // ignore measure failures
          },
        );
      }, delayMs);
    },
    [],
  );

  return { scrollRef, scrollInputIntoView };
}
