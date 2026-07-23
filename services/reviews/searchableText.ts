import type { CriterionRating, Restaurant, Review } from '@/data/types';

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
