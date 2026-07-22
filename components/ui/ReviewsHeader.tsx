import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';

type ReviewsHeaderProps = {
  title?: string;
  /** Swift: only on My reviews (not Friends'). */
  showShare?: boolean;
  canShare?: boolean;
  sharing?: boolean;
  onShare?: () => void;
  /** Swift `canUseFilters` — hide when source has no reviews. */
  showFilter?: boolean;
  canFilter?: boolean;
  /** Swift `isFilterActive` — gold icon. */
  filterActive?: boolean;
  onFilter?: () => void;
};

/**
 * Reviews tab bar: share + filter around the shared fixed-height HouseNavHeader.
 */
export function ReviewsHeader({
  title = 'Reviews',
  showShare = true,
  canShare = false,
  sharing = false,
  onShare,
  showFilter = true,
  canFilter = false,
  filterActive = false,
  onFilter,
}: ReviewsHeaderProps) {
  return (
    <HouseNavHeader
      title={title}
      left={
        showShare ? (
          <HouseToolbarIconButton
            iosName="square.and.arrow.up"
            androidName="ios-share"
            accessibilityLabel="Share"
            disabled={!canShare || sharing}
            onPress={() => {
              onShare?.();
            }}
          />
        ) : null
      }
      right={
        showFilter ? (
          <HouseToolbarIconButton
            iosName="line.3.horizontal.decrease"
            androidName="filter-list"
            accessibilityLabel="Filters"
            disabled={!canFilter}
            emphasized={filterActive}
            onPress={() => {
              onFilter?.();
            }}
          />
        ) : null
      }
    />
  );
}
