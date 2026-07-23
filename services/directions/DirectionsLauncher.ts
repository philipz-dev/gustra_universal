import {
  ActionSheetIOS,
  InteractionManager,
  Linking,
  Platform,
} from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';

/** Wait for a native Modal / ActionSheet to finish dismissing before presenting UI. */
function afterPresentationSettles(work: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(work, Platform.OS === 'ios' ? 320 : 50);
  });
}

async function safeOpenURL(url: string): Promise<void> {
  try {
    // `canOpenURL` is unreliable / unnecessary for http(s); only gate custom schemes.
    if (!/^https?:/i.test(url)) {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        afterPresentationSettles(() => {
          houseAlert(
            'Unable to open',
            'This app is not available on this device.',
          );
        });
        return;
      }
    }
    await Linking.openURL(url);
  } catch {
    afterPresentationSettles(() => {
      houseAlert('Unable to open', 'This app is not available on this device.');
    });
  }
}

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

    const label = encodeURIComponent(name.trim() || 'Destination');
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

    const appURL = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
    const webURL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    try {
      if (await Linking.canOpenURL(appURL)) {
        await Linking.openURL(appURL);
        return;
      }
    } catch {
      // Fall through to web.
    }
    await safeOpenURL(webURL);
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
   * When true, wait before presenting (caller is dismissing an RN Modal first).
   * Presenting ActionSheetIOS / another Modal while one is visible crashes iOS.
   */
  afterModalDismiss?: boolean;
};

async function showDirectionsChooser(args: PresentDirectionsArgs): Promise<void> {
  const latitude = asCoord(args.latitude);
  const longitude = asCoord(args.longitude);
  const name = args.name?.trim() || 'Destination';

  if (!restaurantHasCoordinates(latitude, longitude)) {
    houseAlert('Get directions', 'No map location is available.');
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
      ? ['Apple Maps', 'Google Maps', 'Waze', 'Cancel']
      : ['Apple Maps', 'Google Maps', 'Cancel'];
    const cancelButtonIndex = options.length - 1;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Get directions',
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

  const buttons = [
    {
      text: 'Maps',
      onPress: openApple,
    },
    { text: 'Google Maps', onPress: openGoogle },
    ...(wazeAvailable
      ? [{ text: 'Waze', onPress: openWaze }]
      : []),
    { text: 'Cancel', style: 'cancel' as const },
  ];
  houseAlert('Get directions', message, buttons);
}

/**
 * Present map-app choices.
 * On iOS this uses `ActionSheetIOS` synchronously (Swift `confirmationDialog`).
 */
export function presentDirectionsOptions(args: PresentDirectionsArgs): void {
  if (args.afterModalDismiss) {
    afterPresentationSettles(() => {
      void showDirectionsChooser(args);
    });
    return;
  }
  void showDirectionsChooser(args);
}
