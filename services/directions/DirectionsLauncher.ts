import { Linking, Platform } from 'react-native';
import { houseAlert } from '@/components/ui/HouseAlert';

/**
 * Opens a destination in Apple Maps, Google Maps, or Waze
 * (Swift `DirectionsLauncher`).
 */
export const DirectionsLauncher = {
  async openAppleMaps(name: string, latitude: number, longitude: number) {
    const label = encodeURIComponent(name.trim() || 'Destination');
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d&q=${label}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    await Linking.openURL(url);
  },

  async openGoogleMaps(latitude: number, longitude: number) {
    const appURL = `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
    const webURL = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    try {
      const canOpen = await Linking.canOpenURL(appURL);
      if (canOpen) {
        await Linking.openURL(appURL);
        return;
      }
    } catch {
      // Fall through to web.
    }
    await Linking.openURL(webURL);
  },

  async canOpenWaze(): Promise<boolean> {
    try {
      return await Linking.canOpenURL('waze://');
    } catch {
      return false;
    }
  },

  async openWaze(latitude: number, longitude: number) {
    await Linking.openURL(
      `waze://?ll=${latitude},${longitude}&navigate=yes`,
    );
  },
};

export function restaurantHasCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  );
}

export async function presentDirectionsOptions(args: {
  name: string;
  addressLine?: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
  const { Alert } = await import('react-native');
  const { name, addressLine, latitude, longitude } = args;
  if (!restaurantHasCoordinates(latitude, longitude)) {
    houseAlert('Get directions', 'No map location is available.');
    return;
  }

  const buttons: {
    text: string;
    onPress?: () => void;
    style?: 'cancel' | 'default' | 'destructive';
  }[] = [
    {
      text: 'Apple Maps',
      onPress: () => {
        void DirectionsLauncher.openAppleMaps(name, latitude, longitude);
      },
    },
    {
      text: 'Google Maps',
      onPress: () => {
        void DirectionsLauncher.openGoogleMaps(latitude, longitude);
      },
    },
  ];

  if (await DirectionsLauncher.canOpenWaze()) {
    buttons.push({
      text: 'Waze',
      onPress: () => {
        void DirectionsLauncher.openWaze(latitude, longitude);
      },
    });
  }

  buttons.push({ text: 'Cancel', style: 'cancel' });

  houseAlert(
    'Get directions',
    addressLine?.trim() || name,
    buttons,
  );
}
