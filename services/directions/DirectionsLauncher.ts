import { ActionSheetIOS, InteractionManager, Linking, Platform } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { i18n } from '@/i18n';
import {
  afterPresentationSettles,
  safeOpenURL,
} from '@/services/linking/safeLinking';

function asCoord(value: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

async function canOpenWaze(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('waze://');
  } catch {
    return false;
  }
}

/**
 * Opens a destination in Apple Maps, Google Maps, or Waze
 * (Swift `DirectionsLauncher`).
 */
export const DirectionsLauncher = {
  async openAppleMaps(name: string, latitude: number, longitude: number) {
    const lat = asCoord(latitude);
    const lng = asCoord(longitude);
    if (!restaurantHasCoordinates(lat, lng)) return;

    const label = encodeURIComponent(
      name.trim() || i18n.t('directions.destination'),
    );
    const url =
      Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${label}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    await safeOpenURL(url);
  },

  async openGoogleMaps(latitude: number, longitude: number) {
    const lat = asCoord(latitude);
    const lng = asCoord(longitude);
    if (!restaurantHasCoordinates(lat, lng)) return;

    if (Platform.OS === 'ios') {
      const appURL = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      const webURL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const openedApp = await safeOpenURL(appURL, { alertOnFailure: false });
      if (openedApp) return;
      await safeOpenURL(webURL);
    } else {
      // Android: Google Maps turn-by-turn navigation Intent starts directions directly
      const navigationURL = `google.navigation:q=${lat},${lng}&mode=d`;
      const webURL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const openedApp = await safeOpenURL(navigationURL, { alertOnFailure: false });
      if (openedApp) return;
      await safeOpenURL(webURL);
    }
  },

  async openWaze(latitude: number, longitude: number) {
    const lat = asCoord(latitude);
    const lng = asCoord(longitude);
    if (!restaurantHasCoordinates(lat, lng)) return;
    await safeOpenURL(`waze://?ll=${lat},${lng}&navigate=yes`);
  },
};

export function restaurantHasCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  const lat = asCoord(latitude);
  const lng = asCoord(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export type PresentDirectionsArgs = {
  name: string;
  addressLine?: string;
  latitude: number;
  longitude: number;
  /**
   * When true, wait longer before presenting (caller is dismissing an RN Modal).
   * Presenting ActionSheetIOS / another Modal while one is visible crashes iOS.
   */
  afterModalDismiss?: boolean;
};

async function showDirectionsChooser(args: PresentDirectionsArgs): Promise<void> {
  try {
    const latitude = asCoord(args.latitude);
    const longitude = asCoord(args.longitude);
    const name = args.name?.trim() || i18n.t('directions.destination');

    if (!restaurantHasCoordinates(latitude, longitude)) {
      houseAlert(i18n.t('directions.title'), i18n.t('directions.noLocation'));
      return;
    }

    // ActionSheetIOS can misbehave with very long messages.
    const rawMessage = args.addressLine?.trim() || name;
    const message =
      rawMessage.length > 160 ? `${rawMessage.slice(0, 157)}…` : rawMessage;

    const openApple = () => {
      afterPresentationSettles(() => {
        void DirectionsLauncher.openAppleMaps(name, latitude, longitude);
      });
    };
    const openGoogle = () => {
      afterPresentationSettles(() => {
        void DirectionsLauncher.openGoogleMaps(latitude, longitude);
      });
    };
    const openWaze = () => {
      afterPresentationSettles(() => {
        void DirectionsLauncher.openWaze(latitude, longitude);
      });
    };

    // Swift `DirectionsLauncher.canOpenWaze` — omit Waze when not installed.
    const wazeAvailable = await canOpenWaze();

    if (Platform.OS === 'ios') {
      const options = wazeAvailable
        ? [
            i18n.t('directions.appleMaps'),
            i18n.t('directions.googleMaps'),
            i18n.t('directions.waze'),
            i18n.t('directions.cancel'),
          ]
        : [
            i18n.t('directions.appleMaps'),
            i18n.t('directions.googleMaps'),
            i18n.t('directions.cancel'),
          ];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: i18n.t('directions.title'),
          message,
          options,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) openApple();
          else if (buttonIndex === 1) openGoogle();
          else if (wazeAvailable && buttonIndex === 2) openWaze();
        },
      );
      return;
    }

    houseAlert(i18n.t('directions.title'), message, [
      { text: i18n.t('directions.maps'), onPress: openApple },
      { text: i18n.t('directions.googleMaps'), onPress: openGoogle },
      ...(wazeAvailable
        ? [{ text: i18n.t('directions.waze'), onPress: openWaze }]
        : []),
      { text: i18n.t('directions.cancel'), style: 'cancel' as const },
    ]);
  } catch {
    houseAlert(i18n.t('directions.title'), i18n.t('directions.openFailed'));
  }
}

/**
 * Present map-app choices.
 * Always settles briefly first so we never race a dismissing Modal / sheet.
 * `afterModalDismiss` uses a longer iOS delay after a full-screen map Modal.
 */
export function presentDirectionsOptions(args: PresentDirectionsArgs): void {
  const delayMs =
    args.afterModalDismiss && Platform.OS === 'ios' ? 480 : Platform.OS === 'ios' ? 320 : 50;

  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      void showDirectionsChooser(args);
    }, delayMs);
  });
}
