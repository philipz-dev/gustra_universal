import type { ReactNode } from 'react';

/**
 * Web: no soft keyboard / TextInputState internals — pass through.
 */
export function GlobalKeyboardDismiss({ children }: { children: ReactNode }) {
  return children;
}
