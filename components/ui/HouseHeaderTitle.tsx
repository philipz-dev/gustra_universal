import { StyleSheet, Text, View } from 'react-native';

import { SERIF_FONT, systemSerifFamily, Theme } from '@/constants/Theme';

type HouseHeaderTitleProps = {
  children: string;
  /** Main tabs use 36; secondary stack screens use 32. */
  size?: number;
};

/**
 * Serif nav title (fallback when not using HouseNavHeader).
 * Line box is tall enough for descenders (y, g, j).
 */
export function HouseHeaderTitle({
  children,
  size = Theme.navigation.titleSize,
}: HouseHeaderTitleProps) {
  const lineHeight = Math.round(size * 1.28);

  return (
    <View style={styles.wrap}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.title, { fontSize: size, lineHeight, marginTop: 2 }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  title: {
    fontFamily: SERIF_FONT || systemSerifFamily,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
