import { useCallback, useSyncExternalStore } from 'react';

/**
 * Hidden "Developer" settings menu — a secret Easter-egg gate.
 *
 * The Developer section in Settings is invisible by default. It appears
 * after the user long-presses the Settings tab in the floating tab bar, and
 * hides again on another long-press (toggle). This is a per-session,
 * in-memory flag shared between the tab bar (which fires the toggle) and the
 * Settings screen (which reveals the section).
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

/** Reveals the hidden Developer section. No-op when already unlocked. */
export function unlockAdvancedMenu(): boolean {
  if (advancedUnlocked) return false;
  advancedUnlocked = true;
  emitChange();
  return true;
}

/** Hides the Developer section again. No-op when already locked. */
export function lockAdvancedMenu(): boolean {
  if (!advancedUnlocked) return false;
  advancedUnlocked = false;
  emitChange();
  return true;
}

/**
 * Toggle the hidden Developer section (long-press Settings tab opens it,
 * long-press again closes it). Returns the new unlocked state.
 */
export function toggleAdvancedMenu(): boolean {
  advancedUnlocked = !advancedUnlocked;
  emitChange();
  return advancedUnlocked;
}

/** Test-only: back to the locked state (not used by the app). */
export function resetAdvancedMenuUnlocked(): void {
  if (!advancedUnlocked) return;
  advancedUnlocked = false;
  emitChange();
}

/** Accessor for the hidden Developer section. */
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
