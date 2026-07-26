import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, systemSerifFamily, Theme } from '@/constants/Theme';

export const HOUSE_NAV_CONTENT_HEIGHT = 44 + Theme.navigation.barExtraHeight;

type HouseNavHeaderProps = {
  title: string;
  /** Main tabs: 34; secondary stack: 30. */
  titleSize?: number;
  left?: ReactNode;
  right?: ReactNode;
  /** Leading chevron that calls onBack (stack screens). */
  showBack?: boolean;
  onBack?: () => void;
};

/**
 * Fixed-height forest-green nav bar (safe area + 44 + barExtraHeight).
 * Shared by tabs and stack so the banner never jumps; line box fits serif descenders.
 */
export function HouseNavHeader({
  title,
  titleSize = Theme.navigation.titleSize,
  left,
  right,
  showBack = false,
  onBack,
}: HouseNavHeaderProps) {
  const insets = useSafeAreaInsets();
  // Serif descenders (y, g, j) need a taller line box than size+2.
  const lineHeight = Math.round(titleSize * 1.28);

  const leading =
    left ??
    (showBack && onBack ? (
      <HouseToolbarIconButton
        iosName="chevron.backward"
        androidName="arrow-back"
        accessibilityLabel="Back"
        onPress={onBack}
      />
    ) : null);

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {leading ? (
          <View style={[styles.side, styles.sideLeft]} pointerEvents="box-none">
            {leading}
          </View>
        ) : null}

        <View style={styles.titleWrap} pointerEvents="none">
          <Text
            numberOfLines={1}
            // Swift `titleLabel`: lineLimit(1) + minimumScaleFactor(0.75)
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[
              styles.title,
              {
                fontSize: titleSize,
                lineHeight,
                // Optical nudge like Swift titlePositionAdjustment; kept inside the line box.
                marginTop: 2,
              },
            ]}>
            {title}
          </Text>
        </View>

        {right ? (
          <View style={[styles.side, styles.sideRight]} pointerEvents="box-none">
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: GustraColors.forestGreen,
  },
  content: {
    height: HOUSE_NAV_CONTENT_HEIGHT,
    justifyContent: 'center',
    overflow: 'visible',
  },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: 'center',
    zIndex: 2,
  },
  sideLeft: {
    left: 8,
    alignItems: 'flex-start',
  },
  sideRight: {
    right: 8,
    alignItems: 'flex-end',
    width: undefined,
    maxWidth: 120,
  },
  titleWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 96,
    overflow: 'visible',
  },
  title: {
    fontFamily: SERIF_FONT || systemSerifFamily,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
