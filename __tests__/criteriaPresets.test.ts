import {
  STANDARD_CRITERIA,
  FIRST_START_ENABLED_STANDARD_IDS,
  QUICK_PRESET_STANDARD_IDS,
  ESSENTIALS_PRESET_STANDARD_IDS,
  MANDATORY_STANDARD_CRITERION_IDS,
  FULL_CONTROL_INITIAL_STANDARD_IDS,
  QUICK_SETUP_CHOICE,
  ESSENTIALS_SETUP_CHOICE,
  FULL_CONTROL_SETUP_CHOICE,
  firstStartDisabledStandardIds,
  type StandardCriterionId,
} from '@/context/CriteriaSettings';

const allIds = new Set<string>(STANDARD_CRITERIA.map((c) => c.id));

function expectValidPreset(ids: readonly StandardCriterionId[]) {
  for (const id of ids) {
    expect(allIds.has(id)).toBe(true);
  }
}

describe('criteria presets', () => {
  it('Quick enables exactly food, drinks and service (all valid)', () => {
    expect(QUICK_PRESET_STANDARD_IDS).toEqual(['food', 'drinks', 'service']);
    expectValidPreset(QUICK_PRESET_STANDARD_IDS);
  });

  it('Essentials equals the first-start core five', () => {
    expect(ESSENTIALS_PRESET_STANDARD_IDS).toEqual(
      FIRST_START_ENABLED_STANDARD_IDS,
    );
    expect(ESSENTIALS_PRESET_STANDARD_IDS).toHaveLength(5);
    expectValidPreset(ESSENTIALS_PRESET_STANDARD_IDS);
  });

  it('no criterion is mandatory anymore (reviews complete with any rated criterion)', () => {
    expect(MANDATORY_STANDARD_CRITERION_IDS).toEqual([]);
    // Presets stay as-is — nothing forces 'food' to stay enabled.
    expectValidPreset(QUICK_PRESET_STANDARD_IDS);
    expectValidPreset(ESSENTIALS_PRESET_STANDARD_IDS);
  });

  it('Quick/Essentials complete setup; Full control opens the screen', () => {
    expect(QUICK_SETUP_CHOICE.completeSetup).toBe(true);
    expect(QUICK_SETUP_CHOICE.ids).toEqual(['food', 'drinks', 'service']);
    expect(ESSENTIALS_SETUP_CHOICE.completeSetup).toBe(true);
    expect(ESSENTIALS_SETUP_CHOICE.ids).toEqual(
      FIRST_START_ENABLED_STANDARD_IDS,
    );
  });

  it('Full control opens the criteria screen without completing setup', () => {
    expect(FULL_CONTROL_SETUP_CHOICE.ids).toBeNull();
    expect(FULL_CONTROL_SETUP_CHOICE.completeSetup).toBe(false);
    // Full control no longer resets criteria to a fixed preset — the screen
    // keeps whatever selection is already loaded (first-start defaults for a
    // new install, or the user's own earlier choices). The historic preset is
    // kept as a valid reference.
    expectValidPreset(FULL_CONTROL_INITIAL_STANDARD_IDS);
  });

  it('first-start defaults enable the core five', () => {
    const disabled = firstStartDisabledStandardIds();
    expect(disabled.has('food')).toBe(false);
    expect(disabled.has('drinks')).toBe(false);
    expect(disabled.has('service')).toBe(false);
    expect(disabled.has('setting')).toBe(false);
    expect(disabled.has('valueForMoney')).toBe(false);
    expect(disabled.has('acoustics')).toBe(true);
  });
});
