import { floorToHalfHour } from '@/i18n/formatDates';

function iso(date: Date): string {
  return date.toISOString();
}

describe('floorToHalfHour', () => {
  it('floors minutes down to :00', () => {
    const d = new Date('2026-08-03T20:12:45.000Z');
    expect(iso(floorToHalfHour(d))).toBe('2026-08-03T20:00:00.000Z');
  });

  it('floors minutes down to :30', () => {
    const d = new Date('2026-08-03T20:42:00.000Z');
    expect(iso(floorToHalfHour(d))).toBe('2026-08-03T20:30:00.000Z');
  });

  it('keeps an exact half hour unchanged', () => {
    const d = new Date('2026-08-03T20:30:59.999Z');
    expect(iso(floorToHalfHour(d))).toBe('2026-08-03T20:30:00.000Z');
  });

  it('zeroes seconds and milliseconds', () => {
    const d = new Date('2026-08-03T09:29:59.999Z');
    expect(iso(floorToHalfHour(d))).toBe('2026-08-03T09:00:00.000Z');
  });

  it('does not mutate the input date', () => {
    const d = new Date('2026-08-03T20:42:00.000Z');
    floorToHalfHour(d);
    expect(iso(d)).toBe('2026-08-03T20:42:00.000Z');
  });

  it('floors across hour/day boundaries', () => {
    const d = new Date('2026-08-03T23:59:00.000Z');
    expect(iso(floorToHalfHour(d))).toBe('2026-08-03T23:30:00.000Z');
  });
});
