import type { WineLabelFiche } from '@/data/types';

/**
 * In-memory fiche for `/wine-label-fiche?preview=1` (review form draft).
 * Optional `editIndex` = editing that wine in the form list.
 */
let preview: WineLabelFiche | null = null;
let editIndex: number | null = null;

export function setPreviewWineLabelFiche(
  fiche: WineLabelFiche | null,
  options?: { editIndex?: number | null },
): void {
  preview = fiche;
  editIndex =
    typeof options?.editIndex === 'number' && options.editIndex >= 0
      ? options.editIndex
      : null;
}

export function getPreviewWineLabelFiche(): WineLabelFiche | null {
  return preview;
}

export function getPreviewWineLabelEditIndex(): number | null {
  return editIndex;
}

export function clearPreviewWineLabelFiche(): void {
  preview = null;
  editIndex = null;
}
