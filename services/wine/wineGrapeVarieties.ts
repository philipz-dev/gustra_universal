import type { WineGrapeBlend } from '@/data/types';

/**
 * Parse Vision `grapeVarieties` / `grapeBlend` / legacy `grapes` into a
 * filterable list, display string, and optional blend with %.
 */
export function parseGrapeVarieties(raw: {
  grapeVarieties?: unknown;
  grapes?: unknown;
  grapeBlend?: unknown;
}): {
  grapeVarieties?: string[];
  grapes: string | null;
  grapeBlend?: WineGrapeBlend[];
} {
  const blend = parseGrapeBlend(raw.grapeBlend);
  if (blend?.length) {
    const names = blend.map((b) => b.name);
    return {
      grapeVarieties: names,
      grapes: formatGrapeBlendDisplay(blend),
      grapeBlend: blend,
    };
  }

  const fromArray = asStringList(raw.grapeVarieties);
  if (fromArray.length > 0) {
    return {
      grapeVarieties: fromArray,
      grapes: fromArray.join(', '),
    };
  }

  const fromString = asTrimmedString(raw.grapes);
  if (!fromString) {
    return { grapes: null };
  }

  const split = fromString
    .split(/[,;/]| & | en | and | und | e | y /i)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = uniquePreserveOrder(split.length > 1 ? split : [fromString]);
  return {
    grapeVarieties: unique,
    grapes: fromString,
  };
}

export function parseGrapeBlend(raw: unknown): WineGrapeBlend[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: WineGrapeBlend[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (!name || /^null$/i.test(name)) continue;
      out.push({ name });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const nameRaw = rec.name ?? rec.grape ?? rec.variety;
    if (typeof nameRaw !== 'string') continue;
    const name = nameRaw.trim();
    if (!name || /^null$/i.test(name)) continue;
    const percent = normalizeGrapePercent(
      rec.percent ?? rec.percentage ?? rec.pct ?? rec.share,
    );
    out.push(percent != null ? { name, percent } : { name });
  }
  const unique = uniqueBlendPreserveOrder(out);
  return unique.length > 0 ? unique : undefined;
}

/** 1…100 integer, or null. */
export function normalizeGrapePercent(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 100) return n;
    return null;
  }
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{1,3})(?:\s*%?)?$/);
    if (!m) return null;
    const n = Number.parseInt(m[1]!, 10);
    if (n >= 1 && n <= 100) return n;
  }
  return null;
}

export function formatGrapeBlendDisplay(blend: WineGrapeBlend[]): string {
  return blend
    .map((b) =>
      b.percent != null ? `${b.name} ${b.percent}%` : b.name,
    )
    .join(' · ');
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || /^null$/i.test(s) || s === '-' || s === 'n/a') return null;
  return s;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const s = item.trim();
      if (!s || /^null$/i.test(s)) continue;
      out.push(s);
      continue;
    }
    if (item && typeof item === 'object') {
      const name = (item as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim()) out.push(name.trim());
    }
  }
  return uniquePreserveOrder(out);
}

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueBlendPreserveOrder(items: WineGrapeBlend[]): WineGrapeBlend[] {
  const seen = new Set<string>();
  const out: WineGrapeBlend[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Grapes for filter/search — prefers structured list, falls back to `grapes`. */
export function wineLabelGrapeList(fiche: {
  grapeVarieties?: string[] | null;
  grapeBlend?: WineGrapeBlend[] | null;
  grapes?: string | null;
}): string[] {
  if (fiche.grapeBlend?.length) {
    return fiche.grapeBlend.map((g) => g.name.trim()).filter(Boolean);
  }
  if (fiche.grapeVarieties?.length) {
    return fiche.grapeVarieties.map((g) => g.trim()).filter(Boolean);
  }
  return parseGrapeVarieties({ grapes: fiche.grapes }).grapeVarieties ?? [];
}

/** Display line for Smaakprofiel / meta (with % when known). */
export function wineLabelGrapeDisplay(fiche: {
  grapeVarieties?: string[] | null;
  grapeBlend?: WineGrapeBlend[] | null;
  grapes?: string | null;
}): string {
  if (fiche.grapeBlend?.length) {
    return formatGrapeBlendDisplay(fiche.grapeBlend);
  }
  return (
    fiche.grapes?.trim() ||
    wineLabelGrapeList(fiche).join(', ') ||
    ''
  );
}
