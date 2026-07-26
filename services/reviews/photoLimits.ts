/** Max photos per review (Take / Import / wine crop). */
export const MAX_REVIEW_PHOTOS = 12;

export function remainingReviewPhotoSlots(currentCount: number): number {
  return Math.max(0, MAX_REVIEW_PHOTOS - Math.max(0, currentCount));
}
