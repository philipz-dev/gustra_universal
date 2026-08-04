/**
 * Search-radius constants, kept in a pure module so the nearby-list logic and
 * the search cache can use them in unit tests without pulling in the Google
 * Places networking stack (expo-constants etc.).
 */

/** Default radius for nearby/list searches and text-search bias. */
export const DEFAULT_SEARCH_RADIUS_M = 2_000;

/**
 * Hard cap for Nearby Search: Google Places returns at most 20 results,
 * ranked by distance — a wider circle therefore only adds far-away places
 * when fewer than 20 exist closer by (remote areas).
 */
export const MAX_NEARBY_SEARCH_RADIUS_M = 50_000;
