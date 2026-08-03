import { resolveTitleFit } from '@/services/ui/titleFit';

/**
 * "Herinnering toevoegen" @32pt serif = 359.7pt wide (measured from the
 * Source Serif 4 SemiBold font metrics used by HouseNavHeader).
 * iPhone 17 Pro window = 402pt logical; with a back button + done button the
 * title inset is 56pt per side -> available = 402 - 112 = 290.
 */
describe('resolveTitleFit', () => {
  it('keeps short titles at full size', () => {
    expect(resolveTitleFit(187.2, 32, 290)).toEqual({
      fontSize: 32,
      wrapsToTwoLines: false,
    });
  });

  it('scales "Herinnering toevoegen" down to a whole pt that still fits on one line', () => {
    // oneLineScale = 288 / 359.7 ≈ 0.801 -> raw 25.6pt -> round 26pt would be
    // 359.7 * 26/32 = 292.3 > 288, so it steps down to 25pt (281.0 ≤ 288).
    const fit = resolveTitleFit(359.7, 32, 290);
    expect(fit.wrapsToTwoLines).toBe(false);
    expect(fit.fontSize).toBe(25);
    // The chosen size must actually fit within the safe width.
    expect(359.7 * (fit.fontSize / 32)).toBeLessThanOrEqual(288);
  });

  it('wraps a title that cannot fit on one line even at minimum scale', () => {
    // Extremely long single title on a narrow banner.
    const fit = resolveTitleFit(900, 32, 210);
    expect(fit.wrapsToTwoLines).toBe(true);
    expect(fit.fontSize).toBe(Math.round(32 * 0.85)); // 27pt wrap size
  });

  it('keeps "Herinneringen" (main tab) on one line with rounding step-down', () => {
    // 260.4 @36pt, available 210 (96pt insets): raw scale 0.799 -> 28.8 ->
    // round 29 would be 260.4*29/36 = 209.8 > 208 -> steps to 28 (202.5 ≤ 208).
    const fit = resolveTitleFit(260.4, 36, 210);
    expect(fit.wrapsToTwoLines).toBe(false);
    expect(fit.fontSize).toBe(28);
    expect(260.4 * (fit.fontSize / 36)).toBeLessThanOrEqual(208);
  });

  it('never produces an ellipsis-sized title that overflows its container', () => {
    // Sweep many widths: the resolved size must either fit one line or wrap.
    for (let w = 100; w <= 1000; w += 7) {
      const fit = resolveTitleFit(w, 32, 210);
      if (!fit.wrapsToTwoLines) {
        expect(w * (fit.fontSize / 32)).toBeLessThanOrEqual(208);
      }
      expect(fit.fontSize).toBeGreaterThan(0);
    }
  });
});
