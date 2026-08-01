import { Text, type TextProps, type TextStyle } from 'react-native';

import { serifStyle, Theme, type SerifWeight } from '@/constants/Theme';

type SerifTextProps = TextProps & {
  size?: number;
  weight?: SerifWeight;
};

export function SerifText({
  size = 17,
  weight = 'semibold',
  style,
  ...rest
}: SerifTextProps) {
  return (
    <Text
      style={[
        serifStyle(size ?? Theme.typography.serifDefault, weight) as TextStyle,
        style,
      ]}
      {...rest}
    />
  );
}
