import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle } from '@/constants/Theme';

type PreparingRecommendationOverlayProps = {
  visible: boolean;
};

/**
 * Full-screen spinner while the JPEG card is rendered
 * (Swift `PreparingRecommendationOverlay`).
 *
 * Uses an absolute View (not Modal) so snapshot capture is not blocked by
 * Modal presentation handles / InteractionManager waits.
 */
export function PreparingRecommendationOverlay({
  visible,
}: PreparingRecommendationOverlayProps) {
  if (!visible) return null;

  return (
    <View
      style={styles.backdrop}
      pointerEvents="auto"
      accessibilityViewIsModal>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={GustraColors.forestGreen} />
        <SerifText size={20} weight="semibold" style={styles.title}>
          Preparing visual recommendation…
        </SerifText>
        <Text style={styles.body}>
          Creating a snapshot of your review. This only takes a moment.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35, 32, 26, 0.4)',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 28,
    backgroundColor: GustraColors.cream,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: GustraColors.ink,
    textAlign: 'center',
  },
  body: {
    ...bodyTextStyle,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(35,32,26,0.65)',
    textAlign: 'center',
  },
});
