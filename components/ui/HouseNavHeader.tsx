import { useLayoutEffect, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, systemSerifFamily, Theme } from '@/constants/Theme';

export const HOUSE_NAV_CONTENT_HEIGHT = 44 + Theme.navigation.barExtraHeight;

type HouseNavHeaderProps = {
  title: string;
  /** Main tabs: 36; secondary stack: 32. */
  titleSize?: number;
  /**
   * Horizontal inset kept clear on each side when a side is occupied by a
   * toolbar button. When neither `left` nor `right` is rendered, a narrower
   * inset is used so longer titles (e.g. "Instellingen") stay close to the
   * full banner size and don't truncate.
   */
  titlePaddingHorizontal?: number;
  left?: ReactNode;
  right?: ReactNode;
  /** Leading chevron that calls onBack (stack screens). */
  showBack?: boolean;
  onBack?: () => void;
  numberOfLines?: number;
};

/** Side inset when no toolbar button occupies that edge. */
const TITLE_PADDING_NO_BUTTON = 24;

/**
 * Never shrink below 50% of the requested size. Lower than the old 60% so
 * longer titles in selection mode ("Selecteer recensies" with two toolbar
 * buttons) still fit on one line even on narrow screens instead of "…".
 */
const TITLE_MIN_FONT_SCALE = 0.5;

/**
 * Fixed-height forest-green nav bar (safe area + 44 + barExtraHeight).
 * Shared by tabs and stack so the banner never jumps; line box fits serif descenders.
 */
export function HouseNavHeader({
  title,
  titleSize = Theme.navigation.titleSize,
  titlePaddingHorizontal = 96,
  left,
  right,
  showBack = false,
  onBack,
  numberOfLines = 1,
}: HouseNavHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Serif descenders (y, g, j) need a taller line box than size+2.
  const lineHeight = Math.round(titleSize * 1.28);
  // Reserve the requested line count (e.g. 2) so a wrapped title never spills
  // out of a single-line bar — even before onTextLayout fires (font swap /
  // fast nav). Never shrink below what the screen asked for.
  const requestedLineCount =
    numberOfLines && numberOfLines > 0 ? numberOfLines : 1;
  const [titleLineCount, setTitleLineCount] = useState(requestedLineCount);
  const resolvedNumberOfLines =
    numberOfLines && numberOfLines > 0 ? numberOfLines : undefined;
  const contentHeight = Math.max(
    HOUSE_NAV_CONTENT_HEIGHT,
    titleLineCount * lineHeight + 20,
  );

  const leading =
    left ??
    (showBack && onBack ? (
      <HouseToolbarIconButton
        iosName="chevron.backward"
        androidName="arrow-back"
        size={28}
        accessibilityLabel="Back"
        onPress={onBack}
      />
    ) : null);

  // Side buttons take real screen space (44 wide, ~52 incl. offset). Only
  // reserve that space when a button is actually rendered — and always
  // symmetrically, so the title stays horizontally centered on the banner.
  // Without buttons (e.g. Instellingen) use a narrow inset so long titles
  // keep the full size instead of truncating ("instell…").
  const hasSideContent = Boolean(leading) || Boolean(right);
  const horizontalInset = hasSideContent
    ? titlePaddingHorizontal
    : Math.min(titlePaddingHorizontal, TITLE_PADDING_NO_BUTTON);

  // RN's adjustsFontSizeToFit misbehaves on iOS (new arch) when combined with
  // a fixed lineHeight: the text scales up to fill the width and clips with
  // "…" instead of shrinking. So we scale explicitly: a hidden copy measures
  // the natural full-size width, then we render the title at the largest size
  // that fits the available width (clamped to 60%).
  const availableTitleWidth = windowWidth - horizontalInset * 2;
  const [unscaledTitleWidth, setUnscaledTitleWidth] = useState(0);
  const [titleFontScale, setTitleFontScale] = useState(1);

  // Re-measure from scratch whenever the title changes.
  useLayoutEffect(() => {
    setTitleFontScale(1);
    setUnscaledTitleWidth(0);
  }, [title]);

  useLayoutEffect(() => {
    if (unscaledTitleWidth <= 0 || availableTitleWidth <= 0) return;
    // Small safety margin so rounding never leaves the text touching the edge.
    const safeAvailable = availableTitleWidth - 2;
    if (unscaledTitleWidth <= safeAvailable) {
      if (titleFontScale !== 1) setTitleFontScale(1);
      return; // already fits at full size
    }
    // Scale down so the whole title fits; never grow, and never exceed the
    // minimum scale (a title that can't fit even then gets the ellipsis).
    const scale = Math.max(
      safeAvailable / unscaledTitleWidth,
      TITLE_MIN_FONT_SCALE,
    );
    if (scale !== titleFontScale) setTitleFontScale(scale);
  }, [availableTitleWidth, titleFontScale, unscaledTitleWidth]);

  const scaledTitleSize = Math.round(titleSize * titleFontScale);
  const scaledLineHeight = Math.round(scaledTitleSize * 1.28);

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={[styles.content, { minHeight: contentHeight }]}>
        {leading ? (
          <View style={[styles.side, styles.sideLeft]} pointerEvents="box-none">
            {leading}
          </View>
        ) : null}

        <View
          style={[
            styles.titleWrap,
            {
              // Inset via left/right (not padding) so `width: '100%'` on the
              // title text resolves to the content box, letting it wrap.
              left: horizontalInset,
              right: horizontalInset,
            },
          ]}
          pointerEvents="none">
          {/* Hidden measurer: renders the title at full size on one line so we
              know the natural width and can shrink the visible title to fit. */}
          <Text
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            numberOfLines={1}
            style={[
              styles.title,
              styles.titleMeasurer,
              {
                fontSize: titleSize,
                lineHeight,
              },
            ]}
            onTextLayout={(event) => {
              const width = event.nativeEvent.lines[0]?.width ?? 0;
              if (width > 0) setUnscaledTitleWidth(width);
            }}>
            {title}
          </Text>
          <Text
            numberOfLines={resolvedNumberOfLines}
            onTextLayout={(event) => {
              const measuredLineCount = Math.max(
                1,
                event.nativeEvent.lines.length,
              );
              const nextLineCount = Math.max(
                requestedLineCount,
                measuredLineCount,
              );
              if (nextLineCount !== titleLineCount) {
                setTitleLineCount(nextLineCount);
              }
            }}
            style={[
              styles.title,
              {
                fontSize: scaledTitleSize,
                lineHeight: scaledLineHeight,
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
    overflow: 'visible',
  },
  title: {
    fontFamily: SERIF_FONT || systemSerifFamily,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
  },
  /** Hidden full-size copy used to measure the unscaled title width. */
  titleMeasurer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 5000,
    opacity: 0,
    zIndex: -1,
  },
});
