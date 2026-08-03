/**
 * Banner title fitting: a pure function so it can be unit-tested without
 * importing React Native. See `resolveTitleFit` for the rules.
 */

/**
 * Never shrink below 50% of the requested size. Lower than the old 60% so
 * longer titles in selection mode ("Selecteer recensies" with two toolbar
 * buttons) still fit on one line even on narrow screens instead of "…".
 */
export const TITLE_MIN_FONT_SCALE = 0.5;

/**
 * When a title can't fit on one line even at the minimum scale, wrap it over
 * a second line at this slightly-smaller-than-full size instead of showing an
 * ellipsis — banner text must never be truncated.
 */
export const TITLE_WRAP_FONT_SCALE = 0.85;

export type TitleFitResult = {
  /** Whole-pt font size to render the title at. */
  fontSize: number;
  /** True when the title should wrap over two lines instead of one. */
  wrapsToTwoLines: boolean;
};

/**
 * Decide the banner title font size and whether it must wrap over two lines.
 *
 * Titles are scaled down (never up) to fit the available width on one line,
 * down to `TITLE_MIN_FONT_SCALE`. Because the rendered size is rounded to a
 * whole pt, the *rounded* size is verified and stepped down a pt when needed
 * — otherwise a title that barely doesn't fit would clip with "…". Titles
 * that still don't fit at the minimum scale wrap over a second line at
 * `TITLE_WRAP_FONT_SCALE` instead of showing an ellipsis.
 */
export function resolveTitleFit(
  unscaledTitleWidth: number,
  titleSize: number,
  availableTitleWidth: number,
): TitleFitResult {
  const safeAvailable = availableTitleWidth - 2;
  if (unscaledTitleWidth <= safeAvailable) {
    return { fontSize: titleSize, wrapsToTwoLines: false };
  }
  const oneLineScale = safeAvailable / unscaledTitleWidth;
  if (oneLineScale >= TITLE_MIN_FONT_SCALE) {
    let roundedSize = Math.round(titleSize * oneLineScale);
    while (
      roundedSize > 1 &&
      unscaledTitleWidth * (roundedSize / titleSize) > safeAvailable
    ) {
      roundedSize -= 1;
    }
    if (roundedSize / titleSize >= TITLE_MIN_FONT_SCALE) {
      return { fontSize: roundedSize, wrapsToTwoLines: false };
    }
  }
  return {
    fontSize: Math.round(titleSize * TITLE_WRAP_FONT_SCALE),
    wrapsToTwoLines: true,
  };
}
