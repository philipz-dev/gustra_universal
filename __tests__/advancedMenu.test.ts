import {
  isAdvancedMenuUnlocked,
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
});
