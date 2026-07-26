/**
 * Light cleanup of wine-label OCR → suggested name + year for Drinks comment.
 */

const YEAR_RE = /\b(19|20)\d{2}\b/;

/** Drop obvious junk lines (alcohol %, volume, importer boilerplate). */
function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) return true;
  if (/^\d+([.,]\d+)?\s*%/.test(t)) return true;
  if (/^\d+([.,]\d+)?\s*(ml|cl|l)\b/i.test(t)) return true;
  if (/^(product of|produit|produced|bottled|importe|contains|allergen)/i.test(t))
    return true;
  if (/^www\.|https?:\/\//i.test(t)) return true;
  return false;
}

export type ParsedWineLabel = {
  /** Full OCR text with line breaks (for display). */
  rawText: string;
  /** Best-effort “Name Year” suggestion for the drinks comment. */
  suggestion: string;
  year: string | null;
};

export function parseWineLabelOcr(raw: string): ParsedWineLabel {
  const rawText = raw.replace(/\r\n/g, '\n').trim();
  const lines = rawText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && !isNoiseLine(l));

  let year: string | null = null;
  for (const line of lines) {
    const m = line.match(YEAR_RE);
    if (m) {
      year = m[0];
      break;
    }
  }
  if (!year) {
    const m = rawText.match(YEAR_RE);
    year = m ? m[0] : null;
  }

  // Prefer a longer “title-like” line without the year alone.
  let name =
    lines.find((l) => l.length >= 4 && !/^\d{4}$/.test(l)) ?? lines[0] ?? '';
  name = name.replace(YEAR_RE, '').replace(/\s+/g, ' ').trim();

  const suggestion = [name, year].filter(Boolean).join(' ').trim();
  return { rawText, suggestion, year };
}
