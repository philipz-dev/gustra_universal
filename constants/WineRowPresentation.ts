/**
 * Review-detail wine rows under Drinks.
 *
 * Set `isRichDetailEnabled` to `false` to restore the plain text+stars list
 * (easy revert without git). Form rows stay compact either way.
 */
export const WineRowPresentation = {
  /** Thumbnail + meta line + softer heading on review detail. */
  isRichDetailEnabled: true,
} as const;
