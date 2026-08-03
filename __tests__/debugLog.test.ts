import {
  clearDebugLog,
  debugLogSize,
  formatDebugLogReport,
  getDebugLogEvents,
  recordMatcherEvent,
  recordSearchEvent,
  type DebugLogSnapshot,
} from '@/services/debug/debugLog';

const emptySnapshot: DebugLogSnapshot = {
  events: [],
  counters: {
    placesToday: 0,
    placesTotal: 0,
    mapsToday: 0,
    mapsTotal: 0,
    geminiToday: 0,
    geminiTotal: 0,
  },
  version: '1.0(1)',
  os: 'iOS',
  appState: 'settings',
};

beforeEach(() => {
  clearDebugLog();
});

describe('debugLog', () => {
  it('records a search event and exposes it', () => {
    recordSearchEvent({
      center: { latitude: 51.05, longitude: 3.72 },
      radius: 2000,
      mode: 'nearby',
      rawPlaces: 12,
      results: 9,
      noPlaceId: 2,
      samples: [
        { id: 'a', name: 'Het Huis', city: 'Gent', distanceMeters: 120 },
      ],
    });
    expect(debugLogSize()).toBe(1);
    const [event] = getDebugLogEvents();
    expect(event.kind).toBe('search');
    if (event.kind === 'search') {
      expect(event.mode).toBe('nearby');
      expect(event.rawPlaces).toBe(12);
      expect(event.results).toBe(9);
      expect(event.noPlaceId).toBe(2);
    }
  });

  it('records a matcher event with matchedVia', () => {
    recordMatcherEvent({
      draftName: 'Het Huis',
      draftPlaceId: 'place_1',
      restaurantsChecked: 3,
      matchedRestaurantId: 'r1',
      matchedVia: 'placeId',
    });
    const [event] = getDebugLogEvents();
    expect(event.kind).toBe('matcher');
    if (event.kind === 'matcher') {
      expect(event.matchedVia).toBe('placeId');
      expect(event.matchedRestaurantId).toBe('r1');
    }
  });

  it('caps the buffer at 30 events (oldest dropped)', () => {
    for (let i = 0; i < 35; i += 1) {
      recordSearchEvent({
        center: null,
        radius: 0,
        mode: 'text-no-center',
        rawPlaces: 1,
        results: 1,
        noPlaceId: 0,
        samples: [],
      });
    }
    expect(debugLogSize()).toBe(30);
    const events = getDebugLogEvents();
    // The first recorded event (index 0) must have been dropped.
    expect(events[0]?.kind).toBe('search');
  });

  it('formats an empty report with a hint', () => {
    const report = formatDebugLogReport(emptySnapshot);
    expect(report).toContain('1.0(1)');
    expect(report).toContain('places 0/0 today');
    expect(report).toContain('geen events');
  });

  it('formats a report with events and counters', () => {
    recordSearchEvent({
      center: { latitude: 51.05, longitude: 3.72 },
      radius: 2000,
      mode: 'nearby',
      rawPlaces: 5,
      results: 3,
      noPlaceId: 1,
      samples: [{ id: 'x', name: 'A', city: 'Gent', distanceMeters: 100 }],
    });
    const report = formatDebugLogReport({
      ...emptySnapshot,
      events: getDebugLogEvents(),
      counters: { ...emptySnapshot.counters, placesToday: 7, placesTotal: 42 },
    });
    expect(report).toContain('places 7/42 today');
    expect(report).toContain('search nearby');
    expect(report).toContain('raw 5 / result 3');
    expect(report).toContain('x «A» Gent 100m');
  });

  it('does not crash when __DEV__ is undefined (node test env)', () => {
    expect(() => {
      recordMatcherEvent({
        draftName: 'X',
        draftPlaceId: null,
        restaurantsChecked: 0,
        matchedRestaurantId: null,
        matchedVia: null,
      });
    }).not.toThrow();
  });
});
