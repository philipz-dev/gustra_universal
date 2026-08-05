import {
  hasAnyRatedCriterion,
  isReviewDraft,
  draftReviewReason,
  isFormDraft,
  formDraftReason,
  wineNeedsRating,
} from '@/services/reviews/draftReview';
import type { CriterionRating, Review, WineLabelFiche } from '@/data/types';

function criteria(ratings: Record<string, number>): CriterionRating[] {
  return Object.entries(ratings).map(([id, rating]) => ({
    id,
    title: id,
    rating,
    comment: '',
  }));
}

function fiche(overrides: Partial<WineLabelFiche> = {}): WineLabelFiche {
  return {
    labelPhotoUri: 'file:///wine.jpg',
    nameAndEstate: 'Test Wine',
    ...overrides,
  };
}

describe('hasAnyRatedCriterion', () => {
  it('is true when at least one criterion has a star rating', () => {
    expect(hasAnyRatedCriterion(criteria({ food: 6 }))).toBe(true);
    expect(hasAnyRatedCriterion(criteria({ service: 8 }))).toBe(true);
    expect(hasAnyRatedCriterion(criteria({ setting: 2 }))).toBe(true);
  });

  it('is false when nothing is rated', () => {
    expect(hasAnyRatedCriterion(criteria({ food: 0 }))).toBe(false);
    expect(hasAnyRatedCriterion(criteria({ food: -1 }))).toBe(false);
    expect(hasAnyRatedCriterion([])).toBe(false);
    expect(hasAnyRatedCriterion(criteria({ food: 0, service: 0 }))).toBe(false);
  });
});

describe('draft detection', () => {
  it('marks a review as draft when no criterion is rated', () => {
    const review = {
      criteria: criteria({ food: 0, service: 8 }),
    } as unknown as Review;
    expect(isReviewDraft(review)).toBe(false);
    expect(draftReviewReason(review)).toBeNull();
  });

  it('marks a review complete when any criterion is rated (no wine attached)', () => {
    const review = {
      criteria: criteria({ food: 6, service: 8 }),
    } as unknown as Review;
    expect(isReviewDraft(review)).toBe(false);
    expect(draftReviewReason(review)).toBeNull();
  });

  it('marks a review as draft when only unrated criteria are present', () => {
    const review = {
      criteria: criteria({ food: 0, service: 0 }),
    } as unknown as Review;
    expect(isReviewDraft(review)).toBe(true);
    expect(draftReviewReason(review)).toBe('criteria');
  });

  it('marks a review as draft when an attached wine lacks a rating', () => {
    const review = {
      criteria: criteria({ food: 6 }),
      wineLabels: [fiche()], // no userRating
    } as unknown as Review;
    expect(isReviewDraft(review)).toBe(true);
    expect(draftReviewReason(review)).toBe('wine');
  });

  it('treats a rated wine as complete', () => {
    const review = {
      criteria: criteria({ food: 6 }),
      wineLabels: [fiche({ userRating: 8 })],
    } as unknown as Review;
    expect(isReviewDraft(review)).toBe(false);
  });

  it('reads the legacy singular wineLabel field too (dual-read)', () => {
    const review = {
      criteria: criteria({ food: 6 }),
      wineLabel: fiche(),
      wineLabels: undefined,
    } as unknown as Review;
    expect(draftReviewReason(review)).toBe('wine');

    const rated = {
      criteria: criteria({ food: 6 }),
      wineLabel: fiche({ userRating: 9 }),
      wineLabels: undefined,
    } as unknown as Review;
    expect(draftReviewReason(rated)).toBeNull();
  });

  it('handles null/undefined reviews', () => {
    expect(isReviewDraft(null)).toBe(true);
    expect(isReviewDraft(undefined)).toBe(true);
    expect(draftReviewReason(null)).toBe('criteria');
  });
});

describe('form-state variants', () => {
  it('mirrors the review logic for the form', () => {
    expect(isFormDraft(criteria({ food: 0 }), [])).toBe(true);
    expect(isFormDraft(criteria({ food: 6 }), [])).toBe(false);
    expect(isFormDraft(criteria({ food: 0, service: 8 }), [])).toBe(false);
    expect(isFormDraft(criteria({ food: 6 }), [fiche()])).toBe(true);
    expect(formDraftReason(criteria({ food: 6 }), [fiche({ userRating: 5 })])).toBeNull();
  });
});

describe('wineNeedsRating', () => {
  it('flags unrated wines', () => {
    expect(wineNeedsRating(fiche())).toBe(true);
    expect(wineNeedsRating(fiche({ userRating: 0 }))).toBe(true);
    expect(wineNeedsRating(fiche({ userRating: 6 }))).toBe(false);
  });
});
