import { Platform } from 'react-native';

/**
 * Development diagnostic log for the "Nearby Restaurants shows only my own
 * reviewed restaurant" bug.
 *
 * A tiny in-memory ring buffer records every restaurant search + matcher
 * event. The hidden Advanced settings row can then render a formatted report
 * (and copy it to the clipboard) so a tester can paste it back verbatim.
 *
 * Writes are async-free and synchronous so they never slow down the search
 * path; the buffer is intentionally small (latest 30 entries).
 */

export type SearchEvent = {
  kind: 'search';
  at: string;
  center: { latitude: number; longitude: number } | null;
  radius: number;
  mode: 'nearby' | 'text' | 'text-no-center';
  rawPlaces: number;
  results: number;
  /** How many of the results had no Google `place.id` (fallback id used). */
  noPlaceId: number;
  samples: { id: string; name: string; city: string; distanceMeters: number | null }[];
  error?: string;
};

export type MatcherEvent = {
  kind: 'matcher';
  at: string;
  draftName: string;
  draftPlaceId: string | null;
  restaurantsChecked: number;
  matchedRestaurantId: string | null;
  matchedVia: 'placeId' | 'nameCity' | 'coords' | 'street' | null;
};

export type DebugLogEvent = SearchEvent | MatcherEvent;

export type DebugLogSnapshot = {
  events: DebugLogEvent[];
  counters: {
    placesToday: number;
    placesTotal: number;
    mapsToday: number;
    mapsTotal: number;
    geminiToday: number;
    geminiTotal: number;
  };
  version: string;
  os: string;
  appState: string;
};

const MAX_EVENTS = 30;

let events: DebugLogEvent[] = [];

/** Record a search event (called from RestaurantSearchService / screens). */
export function recordSearchEvent(event: Omit<SearchEvent, 'at' | 'kind'>): void {
  push({ kind: 'search', at: new Date().toISOString(), ...event });
}

/** Record a matcher event (called from RestaurantMatcher). */
export function recordMatcherEvent(
  event: Omit<MatcherEvent, 'at' | 'kind'>,
): void {
  push({ kind: 'matcher', at: new Date().toISOString(), ...event });
}

function push(event: DebugLogEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
  }
  // Dev console always shows the latest event for fast iteration.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[debuglog]', event.kind, event);
  }
}

/** Clear the buffer (e.g. before reproducing). */
export function clearDebugLog(): void {
  events = [];
}

export function getDebugLogEvents(): DebugLogEvent[] {
  return [...events];
}

/** Number of events currently buffered. */
export function debugLogSize(): number {
  return events.length;
}

/**
 * Render a copy-paste friendly report. Includes the buffered events plus the
 * current API counters + app state, so a tester can paste the whole thing.
 */
export function formatDebugLogReport(snapshot: DebugLogSnapshot): string {
  const lines: string[] = [];
  lines.push(`Gustra debug log — ${snapshot.version} (${snapshot.os})`);
  lines.push(`appState: ${snapshot.appState}`);
  const c = snapshot.counters;
  lines.push(
    `places ${c.placesToday}/${c.placesTotal} today · maps ${c.mapsToday}/${c.mapsTotal} · gemini ${c.geminiToday}/${c.geminiTotal}`,
  );
  lines.push('');
  if (snapshot.events.length === 0) {
    lines.push('(geen events — reproduceer het probleem eerst)');
  }
  for (const event of snapshot.events) {
    lines.push(formatEvent(event));
  }
  return lines.join('\n');
}

function formatEvent(event: DebugLogEvent): string {
  const at = event.at.slice(11, 19); // HH:mm:ss
  if (event.kind === 'search') {
    const center = event.center
      ? `${event.center.latitude.toFixed(5)},${event.center.longitude.toFixed(5)}`
      : 'none';
    const mode = event.mode;
    const base = `[${at}] search ${mode} @${center} r=${event.radius} → raw ${event.rawPlaces} / result ${event.results}`;
    const samples = event.samples
      .map(
        (s) =>
          `${s.id} «${s.name}» ${s.city} ${s.distanceMeters != null ? s.distanceMeters + 'm' : '-'}`,
      )
      .join(' | ');
    return samples ? `${base}\n  ${samples}` : base;
  }
  return `[${at}] matcher «${event.draftName}» place=${event.draftPlaceId ?? '-'} checked=${event.restaurantsChecked} → ${event.matchedRestaurantId ?? 'NONE'} via ${event.matchedVia ?? '-'}`;
}
