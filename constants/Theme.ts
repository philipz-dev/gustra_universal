import { Platform, type TextStyle } from 'react-native';

import { GustraColors } from '@/constants/Colors';

/**
 * Source Serif 4 family names (loaded in app/_layout.tsx).
 * Android paints the same file thinner — use one step heavier there.
 */
export const SERIF_FONT_REGULAR = 'SourceSerif4_400Regular';
export const SERIF_FONT_MEDIUM = 'SourceSerif4_500Medium';
export const SERIF_FONT_SEMIBOLD = 'SourceSerif4_600SemiBold';
export const SERIF_FONT_BOLD = 'SourceSerif4_700Bold';
export const SERIF_FONT_EXTRABOLD = 'SourceSerif4_800ExtraBold';

/** Default display/nav serif — Bold on Android for readability. */
export const SERIF_FONT =
  Platform.OS === 'android' ? SERIF_FONT_BOLD : SERIF_FONT_SEMIBOLD;

/** Closest system serif fallback when custom fonts are unavailable. */
export const systemSerifFamily = Platform.select({
  ios: 'New York',
  android: 'serif',
  default: 'Georgia',
}) as string;

/** Sans body copy — medium weight on Android so Roboto isn’t too thin. */
export const bodyTextStyle: TextStyle =
  Platform.OS === 'android'
    ? { fontWeight: '500', includeFontPadding: false }
    : { fontWeight: '400' };

export const captionTextStyle: TextStyle =
  Platform.OS === 'android'
    ? { fontWeight: '500', includeFontPadding: false }
    : { fontWeight: '400' };

export const Theme = {
  colors: GustraColors,

  radius: {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 16,
    xxl: 18,
  },

  spacing: {
    cardPadding: 14,
    detailSection: 24,
    detailContent: 20,
    listRowVertical: 4,
    listRowHorizontal: 16,
    searchHorizontal: 16,
    searchVertical: 8,
    fabTrailing: 20,
    fabBottom: 12,
    /** Clearance above the floating cream pill tab bar (+ home indicator). */
    floatingTabBarClearance: 78,
  },

  size: {
    thumbnail: 64,
    fab: 60,
    satisfactionDot: 10,
    heroHeight: 220,
    mapThumb: 56,
    avatar: 36,
    starEdit: 30,
  },

  navigation: {
    titleSize: 34,
    secondaryTitleSize: 30,
    largeTitleSize: 37,
    /** Extra breathing room under the title (matches iOS Theme.navigationBarExtraHeight). */
    barExtraHeight: 9,
  },

  fabShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

export type SerifWeight = 'regular' | 'semibold' | 'bold';

export function serifStyle(
  size: number,
  weight: SerifWeight = 'semibold',
): TextStyle {
  let fontFamily: string;

  if (Platform.OS === 'android') {
    // Bump one step vs iOS — Android rasterizes Source Serif lighter.
    fontFamily =
      weight === 'bold'
        ? SERIF_FONT_EXTRABOLD
        : weight === 'regular'
          ? SERIF_FONT_MEDIUM
          : SERIF_FONT_BOLD;
  } else {
    fontFamily =
      weight === 'bold'
        ? SERIF_FONT_BOLD
        : weight === 'regular'
          ? SERIF_FONT_REGULAR
          : SERIF_FONT_SEMIBOLD;
  }

  return {
    fontFamily,
    fontSize: size,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false }
      : null),
  };
}
