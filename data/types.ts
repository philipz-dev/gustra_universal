export type SatisfactionLevel = 'excellent' | 'neutral' | 'avoid';

/** Matches Swift `ReviewOrigin`. */
export type ReviewOrigin = 'own' | 'imported';

export type CriterionRating = {
  id: string;
  title: string;
  rating: number;
  comment: string;
};

export type Restaurant = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string;
  isFavorite: boolean;
  thumbnailColor: string;
  /** Dish or interior photo for feed cards. */
  photoUrl: string;
};

export type Review = {
  id: string;
  restaurantId: string;
  date: string;
  generalComment: string;
  criteria: CriterionRating[];
  /** Hero photos on the detail screen. */
  photoUrls: string[];
  reviewedBy: string;
  overallScore: number;
  /** `own` = app owner; `imported` = friends' shared reviews (Swift). */
  origin: ReviewOrigin;
};

/** Legacy backfill: non-empty `reviewedBy` ⇒ imported (Swift migrate). */
export function resolveReviewOrigin(
  review: Pick<Review, 'origin' | 'reviewedBy'>,
): ReviewOrigin {
  if (review.origin === 'own' || review.origin === 'imported') {
    return review.origin;
  }
  return review.reviewedBy.trim() ? 'imported' : 'own';
}

export type RestaurantVisitSummary = {
  restaurantId: string;
  name: string;
  city: string;
  averageScore: number;
  visitCount: number;
  lastVisitDate: string;
  reviewerName?: string;
  thumbnailColor: string;
  photoUrl: string;
  isFavorite: boolean;
  reviewIds: string[];
};

export function satisfactionFromScore(score: number): SatisfactionLevel {
  if (score >= 4) return 'excellent';
  if (score >= 2.5) return 'neutral';
  return 'avoid';
}
