import type {
  EmailCriterionRow,
  ReviewEmailCardViewProps,
} from '@/components/share/ReviewEmailCardView';
import { placeTypeDisplayName } from '@/constants/PlaceTypeLabels';
import type { Restaurant, Review } from '@/data/types';
import { formatAbbreviatedDate } from '@/i18n/formatDates';
import { formatAddressLine } from '@/services/places/addressFormatting';
import {
  overallScoreFromCriteria,
  RatingValue,
} from '@/services/reviews/ratings';

import { titledRestaurantName } from '@/services/share/ReviewEmailHTML';

export type EmailSnapshotRequest = {
  card: ReviewEmailCardViewProps;
  fileName: string;
};

type CaptureHandlers = {
  resolve: (uri: string) => void;
  reject: (error: Error) => void;
};

let pending:
  | (EmailSnapshotRequest & CaptureHandlers)
  | null = null;
let listener: ((request: EmailSnapshotRequest | null) => void) | null = null;

export function subscribeEmailSnapshot(
  next: (request: EmailSnapshotRequest | null) => void,
): () => void {
  listener = next;
  if (pending) {
    next({ card: pending.card, fileName: pending.fileName });
  }
  return () => {
    if (listener === next) listener = null;
  };
}

export function completeEmailSnapshot(uri: string): void {
  const job = pending;
  pending = null;
  listener?.(null);
  job?.resolve(uri);
}

export function failEmailSnapshot(error: Error): void {
  const job = pending;
  pending = null;
  listener?.(null);
  job?.reject(error);
}

function formatVisitedDate(iso: string): string {
  return formatAbbreviatedDate(iso);
}

export function buildEmailCardProps(args: {
  review: Review;
  restaurant: Restaurant;
  sharedBy: string;
  enabledCriteria: { id: string; title: string }[];
}): ReviewEmailCardViewProps {
  const addressLine = formatAddressLine({
    street: args.restaurant.address,
    city: args.restaurant.city,
    country: args.restaurant.country,
  });
  // Swift: split on first comma only → street / city+country.
  const addressLines: string[] = [];
  if (addressLine) {
    const comma = addressLine.indexOf(',');
    if (comma === -1) {
      addressLines.push(addressLine);
    } else {
      const street = addressLine.slice(0, comma).trim();
      const rest = addressLine.slice(comma + 1).trim();
      if (street) addressLines.push(street);
      if (rest) addressLines.push(rest);
    }
  }

  const metaBits: string[] = [];
  if (args.restaurant.isFavorite) {
    metaBits.push('★ Favorite');
  }
  const primaryType = args.restaurant.primaryType.trim();
  if (primaryType) {
    metaBits.push(placeTypeDisplayName(primaryType));
  }
  metaBits.push(`Visited ${formatVisitedDate(args.review.date)}`);

  const enabledIds = new Set(args.enabledCriteria.map((c) => c.id));
  const titleById = new Map(
    args.enabledCriteria.map((c) => [c.id, c.title] as const),
  );
  const ratedCriteria = args.review.criteria.filter(
    (c) => enabledIds.has(c.id) && RatingValue.isStarRating(c.rating),
  );
  const criteriaRows: EmailCriterionRow[] = ratedCriteria.map((c) => ({
    id: c.id,
    title: titleById.get(c.id) ?? c.title,
    score: RatingValue.starValue(c.rating),
    comment: c.comment.trim(),
  }));

  const overallScore = overallScoreFromCriteria(ratedCriteria);

  return {
    sharedBy: args.sharedBy.trim() || 'Someone',
    restaurantName: titledRestaurantName(args.restaurant.name),
    addressLines,
    metaLine: metaBits.join(' · '),
    photoUris: args.review.photoUrls.filter(Boolean),
    overallScore,
    criteriaRows,
    generalComment: args.review.generalComment,
  };
}

export function attachmentFileName(restaurantName: string): string {
  const base = (restaurantName.trim() || 'review').replace(/\//g, '-');
  return `${base}-gustra.jpg`;
}

/**
 * Renders the email card off-screen via `ReviewEmailSnapshotHost` and returns
 * a temporary JPEG file URI (Swift `ReviewEmailSnapshotService.renderJPEG`).
 */
export function captureReviewEmailJPEG(
  request: EmailSnapshotRequest,
): Promise<string> {
  if (pending) {
    pending.reject(new Error('Another visual recommendation is already preparing.'));
  }
  return new Promise<string>((resolve, reject) => {
    pending = { ...request, resolve, reject };
    listener?.(request);
  });
}
