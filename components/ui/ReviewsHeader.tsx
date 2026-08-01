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
  /** Orange icon when filters are active. */
  filterActive?: boolean;
  onFilter?: () => void;

  // Selection mode props
  isSelecting?: boolean;
  onCancelSelecting?: () => void;
  onConfirmSelecting?: () => void;
  canConfirmSelecting?: boolean;
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
  isSelecting = false,
  onCancelSelecting,
  onConfirmSelecting,
  canConfirmSelecting = false,
}: ReviewsHeaderProps) {
  const { t } = useAppTranslation();
  const resolvedTitle = isSelecting
    ? title ?? t('share.selectReviews')
    : title ?? t('tabs.reviews');

  const left = isSelecting ? (
    <HouseToolbarIconButton
      iosName="xmark"
      androidName="close"
      accessibilityLabel={t('common.cancel')}
      onPress={() => {
        Haptics.light();
        onCancelSelecting?.();
      }}
    />
  ) : showShare ? (
    <HouseToolbarIconButton
      iosName="square.and.arrow.up"
      androidName="share"
      size={28}
      symbolWeight="bold"
      accessibilityLabel={t('a11y.share')}
      disabled={!canShare || sharing}
      onPress={() => {
        Haptics.light();
        onShare?.();
      }}
    />
  ) : null;

  const right = isSelecting ? (
    <HouseToolbarIconButton
      iosName="checkmark"
      androidName="check"
      accessibilityLabel={t('common.done')}
      disabled={!canConfirmSelecting}
      onPress={() => {
        Haptics.success();
        onConfirmSelecting?.();
      }}
    />
  ) : showFilter ? (
    <HouseToolbarIconButton
      ionName="funnel"
      size={26}
      accessibilityLabel={t('a11y.filters')}
      disabled={!canFilter}
      emphasized={filterActive}
      onPress={() => {
        Haptics.selectionChanged();
        onFilter?.();
      }}
    />
  ) : null;

  return (
    <HouseNavHeader
      title={resolvedTitle}
      left={left}
      right={right}
      // Two toolbar buttons (cancel + confirm) eat real space; narrow the
      // inset in selection mode so "Selecteer recensies" keeps more width
      // and the title-scale fallback has room to work.
      titlePaddingHorizontal={isSelecting ? 76 : undefined}
    />
  );
}
