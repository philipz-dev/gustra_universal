import { resolveDistanceUnit, type DistanceUnit } from '@/services/units/units';

/**
 * Swift `RestaurantSearchService.formattedDistance`, now device-unit aware.
 *
 * `unit` defaults to the system measurement system (metric / us / uk).
 * US: feet below ~0.25 mi, miles above. UK: metres below 1 km (British
 * convention), miles above. Metric: m below 1 km, km above.
 */
export function formattedDistance(
  meters: number,
  unit: DistanceUnit = resolveDistanceUnit(),
): string {
  const rounded = Math.round(meters / 10) * 10;
  const miles = meters / 1609.344;

  switch (unit) {
    case 'us': {
      if (rounded < 402.336) {
        // < ~0.25 mi → whole feet (10 m = 32.8 ft, so round to the nearest 10).
        const feet = Math.round((rounded / 0.3048) / 10) * 10;
        return `${feet} ft`;
      }
      return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
    }
    case 'uk': {
      if (rounded < 1000) return `${rounded} m`;
      return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
    }
    case 'metric':
    default: {
      if (rounded >= 1000) {
        const km = rounded / 1000;
        const digits = km >= 100 ? 0 : 1;
        return `${km.toFixed(digits)} km`;
      }
      return `${rounded} m`;
    }
  }
}
