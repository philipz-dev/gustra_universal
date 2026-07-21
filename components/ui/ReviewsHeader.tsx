import { Alert } from 'react-native';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';

type ReviewsHeaderProps = {
  title?: string;
};

/**
 * Reviews tab bar: share + filter around the shared fixed-height HouseNavHeader.
 */
export function ReviewsHeader({ title = 'Reviews' }: ReviewsHeaderProps) {
  return (
    <HouseNavHeader
      title={title}
      left={
        <HouseToolbarIconButton
          iosName="square.and.arrow.up"
          androidName="ios-share"
          accessibilityLabel="Share"
          onPress={() => Alert.alert('Share', 'Coming soon in a later pass.')}
        />
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
