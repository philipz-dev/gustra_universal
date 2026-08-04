import {
  isAdvancedMenuUnlocked,
  lockAdvancedMenu,
  toggleAdvancedMenu,
  unlockAdvancedMenu,
  resetAdvancedMenuUnlocked,
} from '@/context/AdvancedMenu';

describe('AdvancedMenu gate', () => {
  beforeEach(() => {
    resetAdvancedMenuUnlocked();
  });

  it('starts locked', () => {
    expect(isAdvancedMenuUnlocked()).toBe(false);
  });

  it('unlocks once and reports success', () => {
    expect(isAdvancedMenuUnlocked()).toBe(false);
    expect(unlockAdvancedMenu()).toBe(true);
    expect(isAdvancedMenuUnlocked()).toBe(true);
  });

  it('is idempotent — a second unlock returns false', () => {
    expect(unlockAdvancedMenu()).toBe(true);
    expect(unlockAdvancedMenu()).toBe(false);
    expect(isAdvancedMenuUnlocked()).toBe(true);
  });

  it('locks again after a reset', () => {
    unlockAdvancedMenu();
    expect(isAdvancedMenuUnlocked()).toBe(true);
    resetAdvancedMenuUnlocked();
    expect(isAdvancedMenuUnlocked()).toBe(false);
    expect(unlockAdvancedMenu()).toBe(true);
  });

  it('toggles on and off with the long-press gesture', () => {
    expect(toggleAdvancedMenu()).toBe(true);
    expect(isAdvancedMenuUnlocked()).toBe(true);
    expect(toggleAdvancedMenu()).toBe(false);
    expect(isAdvancedMenuUnlocked()).toBe(false);
  });

  it('lockAdvancedMenu hides the section again', () => {
    unlockAdvancedMenu();
    expect(lockAdvancedMenu()).toBe(true);
    expect(isAdvancedMenuUnlocked()).toBe(false);
    expect(lockAdvancedMenu()).toBe(false);
  });
});