import {
  DEFAULT_SEARCH_RADIUS_M,
  distanceMeters,
} from '@/services/places/RestaurantSearchService';
import type { LatLng } from '@/services/places/types';

/** Middelkerke fallback when location is unavailable (Swift `TestLocations`). */
export const FALLBACK_MAP_CENTER: LatLng = {
  latitude: 51.1853,
  longitude: 2.8225,
};

export type MapRegionLike = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Visible-map search radius (Swift GoogleMapView idle projection). */
export function radiusFromRegion(region: MapRegionLike): number {
  const center: LatLng = {
    latitude: region.latitude,
    longitude: region.longitude,
  };
  const corner: LatLng = {
    latitude: region.latitude + region.latitudeDelta / 2,
    longitude: region.longitude + region.longitudeDelta / 2,
  };
  return Math.max(200, Math.min(distanceMeters(center, corner), 50_000));
}

export function regionAround(
  center: LatLng,
  radiusMeters: number = DEFAULT_SEARCH_RADIUS_M,
): MapRegionLike {
  const latDelta = Math.max(0.01, (radiusMeters / 111_320) * 2);
  const cosLat = Math.max(0.2, Math.cos((center.latitude * Math.PI) / 180));
  const lngDelta = Math.max(0.01, latDelta / cosLat);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

const MIN_MOVE_METERS = 120;
const MIN_RADIUS_CHANGE_RATIO = 0.25;

/** Swift `MapSearchView.isSignificantRegionChange`. */
export function isSignificantRegionChange(
  center: LatLng,
  radius: number,
  lastCenter: LatLng | null,
  lastRadius: number,
): boolean {
  if (!lastCenter) return false;

  const moved = distanceMeters(center, lastCenter);
  const moveThreshold = Math.max(MIN_MOVE_METERS, lastRadius * 0.15);
  if (moved >= moveThreshold) return true;

  const radiusDelta = Math.abs(radius - lastRadius) / Math.max(lastRadius, 1);
  return radiusDelta >= MIN_RADIUS_CHANGE_RATIO;
}
