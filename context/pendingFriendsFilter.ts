/**
 * One-shot flag: after share-import, enable “Include friend's reviews”
 * on the next Reviews (or shared-filter) focus.
 */

let pendingEnableFriendsFilter = false;

export function requestEnableFriendsFilter(): void {
  pendingEnableFriendsFilter = true;
}

export function consumePendingEnableFriendsFilter(): boolean {
  const next = pendingEnableFriendsFilter;
  pendingEnableFriendsFilter = false;
  return next;
}
