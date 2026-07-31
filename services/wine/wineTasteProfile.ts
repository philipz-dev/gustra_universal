import type {
  WineLabelFiche,
  WineTasteProfileConfidence,
  WineTastingTrait,
} from '@/data/types';
import { wineLabelGrapeDisplay } from '@/services/wine/wineGrapeVarieties';
import { tasteProfileTraits } from '@/services/wine/wineTastingTraits';

export function parseTasteProfileConfidence(
  raw: unknown,
): WineTasteProfileConfidence | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return undefined;
}

/**
 * Whether the collapsible Smaakprofiel should render.
 * - `low` confidence → never
 * - otherwise need at least one meaningful row (not sweetness-only legacy)
 */
export function shouldShowTasteProfile(
  fiche: WineLabelFiche | null | undefined,
): boolean {
  if (!fiche) return false;
  if (fiche.tasteProfileConfidence === 'low') return false;

  const traits = tasteProfileTraits(fiche.tastingTraits);
  const hasScaleBeyondDefaultSweet =
    traits.some((t) => t.key !== 'sweetness') ||
    traits.some((t) => t.key === 'sweetness' && t.score !== 1);

  const grapes = wineLabelGrapeDisplay(fiche);
  const hasService = Boolean(
    fiche.servingTempHint?.trim() || fiche.aerationHint?.trim(),
  );

  if (fiche.tasteProfileConfidence === 'high' || fiche.tasteProfileConfidence === 'medium') {
    return (
      traits.length > 0 ||
      grapes.length > 0 ||
      hasService
    );
  }

  // Legacy (no confidence): require scales beyond default dry chip, or service / blend %.
  const hasBlendPercent = Boolean(
    fiche.grapeBlend?.some((g) => g.percent != null),
  );
  return hasScaleBeyondDefaultSweet || hasService || hasBlendPercent;
}

export function tasteProfileScaleRows(
  fiche: WineLabelFiche,
): WineTastingTrait[] {
  return tasteProfileTraits(fiche.tastingTraits);
}

/** Marker position 0…1 for a 1…5 score (legacy continuum). */
export function traitScoreToFraction(score: number): number {
  const n = Math.min(5, Math.max(1, Math.round(score)));
  return (n - 1) / 4;
}

/** Bar fill 0…1 for a 0…5 display scale (score/5). */
export function traitScoreToBarFraction(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score / 5));
}

/** Display score on the 0–5 scale (e.g. `4/5` or `4.5/5`). */
export function formatTraitScore(score: number): string {
  if (!Number.isFinite(score)) return '—';
  const n = Math.min(5, Math.max(0, score));
  const text = n % 1 === 0 ? String(n) : n.toFixed(1);
  return `${text}/5`;
}
