import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

import type { LatLng } from '@/services/places/types';

export type ResolvedLocation = {
  coords: LatLng | null;
  error: string | null;
  isAuthorizationDenied: boolean;
};

const LOCATION_REQUIRED =
  'Location access is required to find nearby restaurants.';
const LOCATION_UNAVAILABLE = 'Current location unavailable.';
const LOCATION_TIMEOUT_MS = 12_000;

function coordsFrom(position: Location.LocationObject): LatLng {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location-timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Permission + GPS fix (Swift `LocationService.resolveCurrentLocation`).
 * Android often has a last-known fix while a fresh GPS lock is slow/flaky
 * (especially on emulators) — prefer that before waiting on a new fix.
 */
export async function resolveCurrentLocation(): Promise<ResolvedLocation> {
  const existing = await Location.getForegroundPermissionsAsync();
  let status = existing.status;

  if (status === Location.PermissionStatus.DENIED && !existing.canAskAgain) {
    return {
      coords: null,
      error: LOCATION_REQUIRED,
      isAuthorizationDenied: true,
    };
  }

  if (status !== Location.PermissionStatus.GRANTED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== Location.PermissionStatus.GRANTED) {
    return {
      coords: null,
      error: LOCATION_REQUIRED,
      isAuthorizationDenied: true,
    };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return {
      coords: null,
      error: LOCATION_UNAVAILABLE,
      isAuthorizationDenied: false,
    };
  }

  // Fast path: recent last-known (works when emulator GPS is mocked).
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 1000 * 60 * 30,
      requiredAccuracy: 5_000,
    });
    if (lastKnown) {
      return {
        coords: coordsFrom(lastKnown),
        error: null,
        isAuthorizationDenied: false,
      };
    }
  } catch {
    // Fall through to a live fix.
  }

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        // Low is more reliable on Android emulators than Balanced/High.
        accuracy:
          Platform.OS === 'android'
            ? Location.Accuracy.Low
            : Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      LOCATION_TIMEOUT_MS,
    );
    return {
      coords: coordsFrom(position),
      error: null,
      isAuthorizationDenied: false,
    };
  } catch {
    // Last resort: any cached fix, ignoring age/accuracy filters.
    try {
      const fallback = await Location.getLastKnownPositionAsync();
      if (fallback) {
        return {
          coords: coordsFrom(fallback),
          error: null,
          isAuthorizationDenied: false,
        };
      }
    } catch {
      // ignore
    }

    return {
      coords: null,
      error: LOCATION_UNAVAILABLE,
      isAuthorizationDenied: false,
    };
  }
}

/** Swift `LocationService.openSystemSettings`. */
export function openSystemSettings(): void {
  void Linking.openSettings();
}
