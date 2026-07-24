import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

type ReviewsHeaderProps = {
  title?: string;
  showShare?: boolean;
  canShare?: boolean;
  sharing?: boolean;
  onShare?: () => void;
  showFilter?: boolean;
  canFilter?: boolean;
  /** Gold icon when filters are active. */
  filterActive?: boolean;
  onFilter?: () => void;
};

/**
 * Tab bar: share + filter around the shared fixed-height HouseNavHeader.
 */
export function ReviewsHeader({
  title,
  showShare = true,
  canShare = false,
  sharing = false,
  onShare,
  showFilter = true,
  canFilter = false,
  filterActive = false,
  onFilter,
}: ReviewsHeaderProps) {
  const { t } = useAppTranslation();
  const resolvedTitle = title ?? t('tabs.reviews');

  const left = showShare ? (
    <HouseToolbarIconButton
      iosName="square.and.arrow.up"
      androidName="share"
      accessibilityLabel={t('a11y.share')}
      disabled={!canShare || sharing}
      onPress={() => {
        Haptics.light();
        onShare?.();
      }}
    />
  ) : null;

  return (
    <HouseNavHeader
      title={resolvedTitle}
      left={left}
      right={
        showFilter ? (
          <HouseToolbarIconButton
            iosName="line.3.horizontal.decrease"
            androidName="filter-list"
            accessibilityLabel={t('a11y.filters')}
            disabled={!canFilter}
            emphasized={filterActive}
            onPress={() => {
              Haptics.selectionChanged();
              onFilter?.();
            }}
          />
        ) : null
      }
    />
  );
}
