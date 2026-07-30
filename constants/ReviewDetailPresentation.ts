/**
 * Review detail polish (score header, compact criteria, quote comments, …).
 *
 * Set `isPolishedEnabled` to `false` to restore the previous stacked layout
 * without a git revert. Wine rows stay on `WineRowPresentation`.
 *
 * Set `isStreamlinedEnabled` to `false` to restore:
 * - criterion word labels + wines-average hint
 * - wines nested under Wijnen (not after all scores)
 * - heavier wine cards + full location map thumb
 */
export const ReviewDetailPresentation = {
  isPolishedEnabled: true,
  /**
   * Scan layout: scores first, then wines (inline), compact location;
   * no “Goed” labels; wine meta = region·year·score.
   */
  isStreamlinedEnabled: true,
} as const;
