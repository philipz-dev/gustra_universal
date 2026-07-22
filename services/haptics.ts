import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

/**
 * Central haptic helpers (Swift `Haptics`).
 * No-ops on web; safe to call from UI handlers.
 */
export const Haptics = {
  prepare() {
    // expo-haptics has no prepare; kept for Swift API parity.
  },

  /** Rating scrub / discrete selection change. */
  selectionChanged() {
    if (Platform.OS === 'web') return;
    void ExpoHaptics.selectionAsync();
  },

  /** Soft tap: clear rating, photo added, minor confirmations. */
  light() {
    if (Platform.OS === 'web') return;
    void ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
  },

  /** Favorite toggle, share actions. */
  medium() {
    if (Platform.OS === 'web') return;
    void ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
  },

  /** Successful save / primary completion. */
  success() {
    if (Platform.OS === 'web') return;
    void ExpoHaptics.notificationAsync(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
  },

  warning() {
    if (Platform.OS === 'web') return;
    void ExpoHaptics.notificationAsync(
      ExpoHaptics.NotificationFeedbackType.Warning,
    );
  },

  error() {
    if (Platform.OS === 'web') return;
    void ExpoHaptics.notificationAsync(
      ExpoHaptics.NotificationFeedbackType.Error,
    );
  },
};
