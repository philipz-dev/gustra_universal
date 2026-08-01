import {
  RatingValue,
  formatScoreOutOfFive,
  formatHalfStarOutOfFive,
  overallScoreFromCriteria,
  migrateLegacyCriterionRating,
  migrateLegacyCriteria,
  hasStarRating,
} from '@/services/reviews/ratings';
import type { CriterionRating } from '@/data/types';

describe('RatingValue', () => {
  it('classifies N/A, unrated and star ratings', () => {
    expect(RatingValue.isNotApplicable(-1)).toBe(true);
    expect(RatingValue.isNotApplicable(3)).toBe(false);

    expect(RatingValue.isStarRating(0)).toBe(false);
    expect(RatingValue.isStarRating(-1)).toBe(false);
    expect(RatingValue.isStarRating(1)).toBe(true);
    expect(RatingValue.isStarRating(10)).toBe(true);
    expect(RatingValue.isStarRating(11)).toBe(false);
    expect(RatingValue.isStarRating(Number.NaN)).toBe(false);

    expect(RatingValue.isAnswered(0)).toBe(false);
    expect(RatingValue.isAnswered(-1)).toBe(true);
    expect(RatingValue.isAnswered(7)).toBe(true);
  });

  it('maps half-star steps to star values', () => {
    expect(RatingValue.starValue(2)).toBe(1);
    expect(RatingValue.starValue(7)).toBe(3.5);
    expect(RatingValue.starValue(10)).toBe(5);
  });

  it('computes fill amounts per star index', () => {
    // rating 7 = 3.5★
    expect(RatingValue.fillForStar(1, 7)).toBe(1); // 1.0★ full
    expect(RatingValue.fillForStar(2, 7)).toBe(1); // 2.0★ full
    expect(RatingValue.fillForStar(3, 7)).toBe(1); // 3.0★ full
    expect(RatingValue.fillForStar(4, 7)).toBe(0.5); // 3.5★ half
    expect(RatingValue.fillForStar(5, 7)).toBe(0); // 4.0★ empty

    expect(RatingValue.fillForStar(1, 0)).toBe(0); // unrated
    expect(RatingValue.fillForStar(3, 10)).toBe(1); // 5.0★ all full
  });

  it('derives steps for whole/half star taps', () => {
    expect(RatingValue.steps(3, false)).toBe(6); // 3.0★
    expect(RatingValue.steps(3, true)).toBe(5); // 2.5★
  });
});

describe('formatScoreOutOfFive', () => {
  it('formats whole and half scores', () => {
    expect(formatScoreOutOfFive(3.5)).toBe('3.5/5');
    expect(formatScoreOutOfFive(4)).toBe('4/5');
    expect(formatScoreOutOfFive(5)).toBe('5/5');
    expect(formatScoreOutOfFive(1.25)).toBe('1.3/5'); // toFixed rounds
  });

  it('returns empty for missing or invalid scores', () => {
    expect(formatScoreOutOfFive(0)).toBe('');
    expect(formatScoreOutOfFive(-2)).toBe('');
    expect(formatScoreOutOfFive(Number.NaN)).toBe('');
    expect(formatScoreOutOfFive(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('formatHalfStarOutOfFive', () => {
  it('formats half-star steps', () => {
    expect(formatHalfStarOutOfFive(7)).toBe('3.5/5');
    expect(formatHalfStarOutOfFive(10)).toBe('5/5');
    expect(formatHalfStarOutOfFive(0)).toBe('');
    expect(formatHalfStarOutOfFive(-1)).toBe('');
  });
});

describe('overallScoreFromCriteria', () => {
  const criteria: CriterionRating[] = [
    { id: 'food', title: 'Eten', rating: 8, comment: '' },
    { id: 'service', title: 'Service', rating: 6, comment: '' },
    { id: 'ambiance', title: 'Sfeer', rating: 0, comment: '' },
    { id: 'wines', title: 'Wijnen', rating: -1, comment: '' },
  ];

  it('averages only star-rated criteria', () => {
    expect(overallScoreFromCriteria(criteria)).toBe(3.5); // (4 + 3) / 2
  });

  it('returns 0 when nothing is star-rated', () => {
    expect(overallScoreFromCriteria([])).toBe(0);
    expect(
      overallScoreFromCriteria([
        { id: 'food', title: 'Eten', rating: 0, comment: '' },
      ]),
    ).toBe(0);
  });
});

describe('migrateLegacyCriterionRating', () => {
  it('maps legacy 1–5 stars to half-star steps (×2)', () => {
    expect(migrateLegacyCriterionRating(1)).toBe(2);
    expect(migrateLegacyCriterionRating(3)).toBe(6);
    expect(migrateLegacyCriterionRating(5)).toBe(10);
  });

  it('keeps already-migrated half-star steps', () => {
    expect(migrateLegacyCriterionRating(7)).toBe(7);
    expect(migrateLegacyCriterionRating(10)).toBe(10);
  });

  it('passes N/A through and treats invalid values as unrated', () => {
    expect(migrateLegacyCriterionRating(-1)).toBe(-1);
    expect(migrateLegacyCriterionRating(0)).toBe(0);
    expect(migrateLegacyCriterionRating(11)).toBe(0);
    expect(migrateLegacyCriterionRating(Number.NaN)).toBe(0);
  });

  it('migrates a full criteria list while preserving fields', () => {
    const input: CriterionRating[] = [
      { id: 'food', title: 'Eten', rating: 4, comment: 'lekker' },
      { id: 'wines', title: 'Wijnen', rating: -1, comment: '' },
    ];
    const migrated = migrateLegacyCriteria(input);
    expect(migrated[0]!.rating).toBe(8);
    expect(migrated[0]!.comment).toBe('lekker');
    expect(migrated[1]!.rating).toBe(-1);
  });
});

describe('hasStarRating', () => {
  it('detects any star rating', () => {
    expect(hasStarRating([{ id: 'food', title: 'Eten', rating: 4, comment: '' }])).toBe(true);
    expect(hasStarRating([{ id: 'food', title: 'Eten', rating: 0, comment: '' }])).toBe(false);
    expect(hasStarRating([])).toBe(false);
  });
});
