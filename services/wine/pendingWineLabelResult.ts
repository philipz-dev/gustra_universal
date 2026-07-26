import type { WineLabelFiche } from '@/data/types';

/**
 * Hand-off from wine-label-scan → review-form (Drinks + wine fiche + photo).
 */

export type WineLabelScanResult = {
  /** Text to put in the Drinks comment (suggestion or edited). */
  drinksComment: string;
  /** Kept for search indexing compatibility (summary / empty). */
  ocrText: string;
  /** Label photo to add to review photos when set. */
  croppedUri: string | null;
  /** Structured Gemini fiche; null = no match (hide icon). */
  wineLabel: WineLabelFiche | null;
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
