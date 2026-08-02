import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { GustraColors } from '@/constants/Colors';

/**
 * Source Serif 4 family names (loaded in app/_layout.tsx).
 * Android paints the same file thinner — use one step heavier there.
 * Use only for display/nav titles and restaurant name/score (Swift `Theme.serif`).
 */
export const SERIF_FONT_REGULAR = 'SourceSerif4_400Regular';
export const SERIF_FONT_REGULAR_ITALIC = 'SourceSerif4_400Regular_Italic';
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

/**
 * Body copy — system sans (SF on iOS, Roboto on Android).
 * Never pair with Source Serif; that stays for titles via `SerifText` / `serifStyle`.
 */
export const bodyTextStyle: TextStyle =
  Platform.OS === 'android'
    ? {
        fontFamily: 'sans-serif',
        fontWeight: '400',
        includeFontPadding: false,
        letterSpacing: 0.1,
      }
    : {
        // Default SF; omit fontFamily so UIFont.systemFont resolves correctly.
        fontWeight: '400',
        letterSpacing: -0.24,
      };

/** Secondary / meta labels. */
export const captionTextStyle: TextStyle =
  Platform.OS === 'android'
    ? {
        fontFamily: 'sans-serif-medium',
        fontWeight: '500',
        includeFontPadding: false,
        letterSpacing: 0.15,
      }
    : {
        fontWeight: '400',
        letterSpacing: -0.08,
      };

/** Soft press wash (lists / settings) — prefer over dimming the whole row. */
export const listPressedStyle: ViewStyle = {
  backgroundColor: 'rgba(35, 32, 26, 0.06)',
};

const TYPOGRAPHY = {
  serifDefault: 18,
  sectionHeader: 14,
  navTitle: Platform.OS === 'android' ? 34 : 36,
  navSecondaryTitle: Platform.OS === 'android' ? 30 : 32,
  navLargeTitle: Platform.OS === 'android' ? 36 : 39,
} as const;

/**
 * Android Material-ish type ramp (sp).
 * Use these instead of one-off fontSizes for a calmer, premium density.
 */
export const Type = {
  display: TYPOGRAPHY.navTitle,
  title: TYPOGRAPHY.navSecondaryTitle,
  titleSmall: 22,
  body: Platform.OS === 'android' ? 16 : 17,
  bodySmall: Platform.OS === 'android' ? 14 : 15,
  label: 13,
  caption: Platform.OS === 'android' ? 12 : 13,
} as const;

/** Surface elevation tokens — keep 0–2 only for a tonal cream UI. */
export const Surface = {
  flat: {} as ViewStyle,
  raised: (Platform.OS === 'android'
    ? {
        elevation: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(35, 32, 26, 0.06)',
      }
    : {}) as ViewStyle,
  floating: (Platform.OS === 'android'
    ? {
        elevation: 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(35, 32, 26, 0.08)',
      }
    : {}) as ViewStyle,
} as const;

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
    /**
     * Breathing room between the FAB and the last scrollable content — content
     * must always stop above the FAB so it never blocks text/location rows.
     */
    fabClearance: 24,
    /** Clearance above the floating cream pill tab bar (+ home indicator). */
    floatingTabBarClearance: 78,
  },

  typography: TYPOGRAPHY,

  size: {
    thumbnail: 64,
    fab: 60,
    satisfactionDot: 10,
    heroHeight: 220,
    mapThumb: 56,
    avatar: 36,
    starEdit: 30,
    /** Minimum tappable control — 44 iOS HIG / 48 Material. */
    hitTarget: Platform.OS === 'android' ? 48 : 44,
  },

  navigation: {
    titleSize: Type.display,
    secondaryTitleSize: Type.title,
    largeTitleSize: TYPOGRAPHY.navLargeTitle,
    /** Extra breathing room under the title (matches iOS Theme.navigationBarExtraHeight). */
    barExtraHeight: 9,
  },

  /** Inset-grouped settings / form cards. */
  list: {
    sectionGap: 22,
    sectionHeaderSize: 13,
    rowMinHeight: Platform.OS === 'android' ? 48 : 44,
    separator: 'rgba(35, 32, 26, 0.1)',
    cardBackground: 'rgba(236, 227, 207, 0.55)',
    androidRipple: 'rgba(36, 78, 57, 0.12)',
  },

  fabShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },

  /** Subtle floating overlay shadow (map chips, legend cards, map buttons). */
  overlayShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    letterSpacing: Platform.OS === 'ios' ? -0.4 : 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  };
}
