export type SatisfactionLevel = 'excellent' | 'neutral' | 'avoid';

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
};

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
