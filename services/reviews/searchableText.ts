import type {
  CriterionRating,
  Restaurant,
  Review,
  WineLabelFiche,
} from '@/data/types';
import { wineLabelGrapeList } from '@/services/wine/wineGrapeVarieties';

/**
 * Rebuild the feed search blob (Swift `Review.rebuildSearchableText` + OCR append).
 */
export function rebuildSearchableText(args: {
  restaurant?: Pick<Restaurant, 'name' | 'city' | 'country'> | null;
  generalComment: string;
  criteria: CriterionRating[];
  /** Custom criterion display names (Swift `customCriterionNames`). */
  customCriterionNames?: string[];
  /** Text extracted from review photos. */
  ocrText?: string;
  /** Structured wine fiche fields for feed search / filter. */
  wineLabel?: WineLabelFiche | null;
  /** All wines on the visit (preferred over singular `wineLabel`). */
  wineLabels?: WineLabelFiche[];
}): string {
  const parts: string[] = [];
  if (args.restaurant) {
    parts.push(args.restaurant.name);
    parts.push(args.restaurant.city);
    parts.push(args.restaurant.country);
  }
  for (const criterion of args.criteria) {
    parts.push(criterion.comment);
  }
  parts.push(args.generalComment);
  if (args.customCriterionNames?.length) {
    parts.push(...args.customCriterionNames);
  }
  if (args.ocrText?.trim()) {
    parts.push(args.ocrText.trim());
  }
  const wines =
    args.wineLabels && args.wineLabels.length > 0
      ? args.wineLabels
      : args.wineLabel
        ? [args.wineLabel]
        : [];
  for (const w of wines) {
    if (!w.nameAndEstate?.trim()) continue;
    parts.push(w.nameAndEstate);
    if (w.typeStyle?.trim()) parts.push(w.typeStyle);
    if (w.countryRegion?.trim()) parts.push(w.countryRegion);
    if (w.vintage?.trim()) parts.push(w.vintage);
    if (w.foodPairings?.trim()) parts.push(w.foodPairings);
    parts.push(...wineLabelGrapeList(w));
    if (w.grapes?.trim()) parts.push(w.grapes);
  }
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

export function reviewMatchesSearchQuery(
  review: Pick<Review, 'searchableText'>,
  restaurantName: string | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (restaurantName?.toLowerCase().includes(q)) return true;
  return (review.searchableText ?? '').toLowerCase().includes(q);
}
