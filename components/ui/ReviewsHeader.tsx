import { Alert } from 'react-native';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';

type ReviewsHeaderProps = {
  title?: string;
  /** Swift: only on My reviews (not Friends'). */
  showShare?: boolean;
  canShare?: boolean;
  sharing?: boolean;
  onShare?: () => void;
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
              if (onShare) {
                onShare();
                return;
              }
              Alert.alert('Share', 'Coming soon in a later pass.');
            }}
          />
        ) : null
      }
      right={
        <HouseToolbarIconButton
          iosName="line.3.horizontal.decrease"
          androidName="filter-list"
          accessibilityLabel="Filters"
          onPress={() => Alert.alert('Filters', 'Coming soon in a later pass.')}
        />
      }
    />
  );
}
