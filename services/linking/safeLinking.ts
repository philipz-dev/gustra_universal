import {
  Alert,
  InteractionManager,
  Linking,
  Platform,
} from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { i18n } from '@/i18n';

/**
 * Wait for Modal / ActionSheet / transitions to finish before presenting more UI.
 * Prevents intermittent iOS crashes from stacked presentations.
 */
export function afterPresentationSettles(work: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(work, Platform.OS === 'ios' ? 320 : 50);
  });
}

/**
 * Open a URL without throwing; show a house alert when it fails.
 */
export async function safeOpenURL(
  url: string,
  options?: { alertOnFailure?: boolean },
): Promise<boolean> {
  const alertOnFailure = options?.alertOnFailure !== false;
  try {
    // `canOpenURL` is unreliable for http(s); only gate custom schemes.
    if (!/^https?:/i.test(url)) {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        if (alertOnFailure) {
          afterPresentationSettles(() => {
            houseAlert(
              i18n.t('alerts.linking.unableTitle'),
              i18n.t('alerts.linking.unableBody'),
            );
          });
        }
        return false;
      }
    }
    await Linking.openURL(url);
    return true;
  } catch {
    if (alertOnFailure) {
      afterPresentationSettles(() => {
        houseAlert(
          i18n.t('alerts.linking.unableTitle'),
          i18n.t('alerts.linking.unableBody'),
        );
      });
    }
    return false;
  }
}

/** Open system Settings without throwing. */
export async function safeOpenSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Ignore — Settings may be unavailable on simulators / web.
  }
}

/**
 * Prefer native `Alert` when a full-screen RN Modal is already visible
 * (stacking houseAlert Modals can crash iOS).
 */
export function alertOverModal(title: string, message?: string): void {
  try {
    Alert.alert(title, message);
  } catch {
    afterPresentationSettles(() => houseAlert(title, message));
  }
}
