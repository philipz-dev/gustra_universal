import { findReviewToReuse } from '@/services/reviews/upsertReviewReuse';
import type { Review } from '@/data/types';

function review(overrides: Partial<Review>): Review {
  return {
    id: 'v1',
    restaurantId: 'r1',
    date: '2026-08-05T18:00:00',
    generalComment: '',
    criteria: [
      {
        id: 'food',
        title: 'Food',
        rating: 0,
        comment: '',
      },
    ],
    photoUrls: [],
    reviewedBy: '',
    overallScore: 0,
    origin: 'own',
    ...overrides,
  };
}

describe('findReviewToReuse', () => {
  const sameDay = '2026-08-05T18:00:00';

  it('reuses an in-progress draft for the same restaurant + timestamp', () => {
    const draft = review({ id: 'draft-1' });
    const found = findReviewToReuse([draft], 'r1', sameDay);
    expect(found?.id).toBe('draft-1');
  });

  it('never reuses a completed review — a 4th visit stays a new review', () => {
    const completed = review({
      id: 'v-complete',
      criteria: [{ id: 'food', title: 'Food', rating: 8, comment: '' }],
      overallScore: 8,
    });
    const found = findReviewToReuse([completed], 'r1', sameDay);
    expect(found).toBeUndefined();
  });

  it('ignores reviews for other restaurants and other timestamps', () => {
    const otherRestaurant = review({ id: 'draft-2', restaurantId: 'r2' });
    const otherDay = review({ id: 'draft-3', date: '2026-08-01T18:00:00' });
    expect(
      findReviewToReuse([otherRestaurant, otherDay], 'r1', sameDay),
    ).toBeUndefined();
  });

  it('ignores friend/imported reviews', () => {
    const friendDraft = review({
      id: 'friend-1',
      origin: 'imported',
      reviewedBy: 'Emma',
    });
    const found = findReviewToReuse([friendDraft], 'r1', sameDay);
    expect(found).toBeUndefined();
  });
});
