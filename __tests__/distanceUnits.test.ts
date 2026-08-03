import { formattedDistance } from '@/services/units/distance';
import { resolveDistanceUnit } from '@/services/units/units';

describe('formattedDistance (device-unit aware)', () => {
  it('metric: m below 1 km, km with one decimal above', () => {
    expect(formattedDistance(800, 'metric')).toBe('800 m');
    expect(formattedDistance(3200, 'metric')).toBe('3.2 km');
    expect(formattedDistance(250_000, 'metric')).toBe('250 km');
  });

  it('us: feet below ~0.25 mi, miles above', () => {
    // 100 m ≈ 328 ft → 330 ft (rounded to nearest 10 ft)
    expect(formattedDistance(100, 'us')).toBe('330 ft');
    // 400 m crosses the ~0.25 mi threshold (402 m) → miles
    expect(formattedDistance(3200, 'us')).toBe('2.0 mi');
    // 20 km → whole miles
    expect(formattedDistance(20_000, 'us')).toBe('12 mi');
  });

  it('uk: metres below 1 km, miles above (British convention)', () => {
    expect(formattedDistance(800, 'uk')).toBe('800 m');
    expect(formattedDistance(3200, 'uk')).toBe('2.0 mi');
    expect(formattedDistance(20_000, 'uk')).toBe('12 mi');
  });

  it('defaults to metric when no unit is passed (system metric in tests)', () => {
    expect(formattedDistance(800)).toBe('800 m');
    expect(formattedDistance(3200)).toBe('3.2 km');
  });
});

describe('resolveDistanceUnit', () => {
  it('returns a valid DistanceUnit', () => {
    expect(['metric', 'us', 'uk']).toContain(resolveDistanceUnit());
  });
});
