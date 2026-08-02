import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraColors } from '@/constants/Colors';

/** Floating pill bar height — must match `GustraTabBar` `pill.minHeight`. */
const TAB_PILL_HEIGHT = 62;
/** Wrap bottom inset — must match `GustraTabBar` `paddingBottom`. */
const TAB_WRAP_BOTTOM = 8;

/**
 * Solid cream underlay under the floating pill tab bar — shared by every
 * scrollable tab screen (Reviews, Nearby, Map search, My Gustra, Time
 * Machine, Settings) so scrolled content never shows through around the pill
 * or the home indicator. The bar itself already carries a soft shadow, which
 * provides the "floating" layering — no gradient is needed (a translucent
 * fade over cards looks muddy).
 */
export function TabBarBottomFade() {
  const insets = useSafeAreaInsets();
  const pillBottom = Math.max(insets.bottom, TAB_WRAP_BOTTOM);
  // Cream from the screen bottom up to the pill's top edge: full coverage
  // under/behind the bar, while the pill's own shadow stays visible above it.
  const solidHeight = pillBottom + TAB_PILL_HEIGHT;
  return (
    <View pointerEvents="none" style={[styles.solid, { height: solidHeight }]} />
  );
}

const styles = StyleSheet.create({
  solid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GustraColors.cream,
  },
});
