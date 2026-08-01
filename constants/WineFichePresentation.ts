/**
 * Wine identity card (fiche) presentation toggles.
 *
 * Cutout hero = floating label with elevated shadow, tucked under the nav bar.
 * Set `isCutoutHeroEnabled` to `false` to restore the full-width inset photo card
 * without a git revert.
 *
 * Taste profile = collapsible AI “Smaakprofiel” (traits / grapes % / serve hints).
 * Set `isTasteProfileEnabled` to `false` to hide it and keep the classic meta grid only.
 */
export const WineFichePresentation = {
  /** Reverted: cutout read as a layout glitch; keep card hero. */
  isCutoutHeroEnabled: false,
  /**
   * Taste profile removed (too subjective). Classic meta grid is the only fiche
   * body now; `sweetness` trait still feeds the type × sweetness style chip.
   */
  isTasteProfileEnabled: false,
} as const;

/** How far the cutout label tucks under the forest-green nav (px). */
export const WINE_FICHE_CUTOUT_HEADER_OVERLAP = 28;
