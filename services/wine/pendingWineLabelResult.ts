import type { WineLabelFiche } from '@/data/types';

/**
 * Hand-off from wine-label-scan / wine-label-fiche edit → review-form.
 * Label photo stays on `wineLabel.labelPhotoUri` only — never the review gallery.
 * Rating/notes live on `wineLabel.userRating` / `userComment`.
 */

export type WineLabelScanResult = {
  /**
   * @deprecated Prefer `wineLabel.userComment`. Still applied as a fallback.
   */
  drinksComment: string;
  /**
   * @deprecated Prefer `wineLabel.userRating`. Still applied as a fallback.
   */
  drinksRating?: number;
  /** Kept for search indexing compatibility (summary / empty). */
  ocrText: string;
  /**
   * @deprecated Unused — label photos must not enter review `photoUrls`.
   */
  croppedUri?: string | null;
  /** Structured Gemini fiche (includes userRating / userComment when set). */
  wineLabel: WineLabelFiche | null;
  /**
   * When set, replace the wine at this index in the form list.
   * When omitted, append (new scan).
   */
  replaceIndex?: number;
  /**
   * When set, remove the wine at this index instead of upserting.
   * `wineLabel` may be null.
   */
  removeIndex?: number;
  /**
   * After a remove, leave the review form and open this review’s detail.
   */
  leaveToReviewId?: string;
};

let pending: WineLabelScanResult | null = null;

export function setPendingWineLabelResult(result: WineLabelScanResult): void {
  pending = result;
}

export function takePendingWineLabelResult(): WineLabelScanResult | null {
  const next = pending;
  pending = null;
  return next;
}
