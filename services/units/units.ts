import { getLocales } from 'expo-localization';

export type DistanceUnit = 'metric' | 'us' | 'uk';

/**
 * The device's measurement system (expo-localization SDK 57).
 * iOS/Android already decide this from the user's region/format settings;
 * default to metric when the field is absent.
 */
export function resolveDistanceUnit(): DistanceUnit {
  const system = getLocales()[0]?.measurementSystem;
  return system === 'us' || system === 'uk' ? system : 'metric';
}
