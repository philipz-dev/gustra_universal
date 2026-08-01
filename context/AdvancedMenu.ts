import { useCallback, useSyncExternalStore } from 'react';

/**
 * Hidden "Advanced" settings menu — a secret Easter-egg gate.
 *
 * The Geavanceerd/Advanced section in Settings is invisible by default. It
 * only appears after the user long-presses the Settings tab in the floating
 * tab bar. This is a per-session, in-memory flag shared between the tab bar
 * (which fires the unlock) and the Settings screen (which reveals the section).
 *
 * Implemented as a tiny module singleton with `useSyncExternalStore` so no
 * React context provider is needed in the root layout.
 */

let advancedUnlocked = false;

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function isAdvancedMenuUnlocked(): boolean {
  return advancedUnlocked;
}

/** Reveals the hidden Advanced section. No-op when already unlocked. */
export function unlockAdvancedMenu(): boolean {
  if (advancedUnlocked) return false;
  advancedUnlocked = true;
  emitChange();
  return true;
}

/** Test-only: back to the locked state (not used by the app). */
export function resetAdvancedMenuUnlocked(): void {
  if (!advancedUnlocked) return;
  advancedUnlocked = false;
  emitChange();
}

/** Accessor for the hidden Advanced section. */
export function useAdvancedMenuUnlocked(): boolean {
  return useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    }, []),
    isAdvancedMenuUnlocked,
  );
}
