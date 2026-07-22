import type { RestaurantDraft } from '@/services/places/types';

function clean(value: string): string {
  return value
    .trim()
    .replace(/^,+|,+$/g, '')
    .trim();
}

function containsComponent(haystack: string, needle: string): boolean {
  const n = clean(needle);
  if (!n) return false;
  return haystack.toLocaleLowerCase().includes(n.toLocaleLowerCase());
}

function stripTrailingComponent(value: string, component: string): string {
  const part = clean(component);
  if (!part) return value;
  let result = clean(value);
  const suffixes = [`, ${part}`, ` ${part}`];
  for (const suffix of suffixes) {
    if (
      result.length >= suffix.length &&
      result.slice(-suffix.length).toLocaleLowerCase() ===
        suffix.toLocaleLowerCase()
    ) {
      result = clean(result.slice(0, -suffix.length));
    }
  }
  return result;
}

function userCountryNames(): string[] {
  let regionCode: string | null = null;
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = locale.split(/[-_]/);
    if (parts.length > 1) {
      regionCode = parts[parts.length - 1] ?? null;
    }
  } catch {
    regionCode = null;
  }
  if (!regionCode || regionCode.length !== 2) return [];

  const names = new Set<string>([regionCode]);
  try {
    const displayNames = new Intl.DisplayNames(['en', 'nl', 'fr', 'de'], {
      type: 'region',
    });
    const localized = displayNames.of(regionCode.toUpperCase());
    if (localized) names.add(clean(localized));
  } catch {
    // Intl.DisplayNames unavailable — region code alone is fine.
  }
  return [...names].filter(Boolean);
}

function matchesUserCountry(country: string): boolean {
  const trimmed = clean(country);
  if (!trimmed) return false;
  return userCountryNames().some(
    (name) => name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
  );
}

/**
 * Street / city / country for UI (Swift `AddressFormatting.line`).
 * Omits country when it matches the device region.
 */
export function formatAddressLine(input: {
  street?: string;
  city?: string;
  country?: string;
}): string | null {
  let streetPart = clean(input.street ?? '');
  const cityPart = clean(input.city ?? '');
  const countryPart = clean(input.country ?? '');

  if (streetPart) {
    if (countryPart) {
      streetPart = stripTrailingComponent(streetPart, countryPart);
    }
    for (const name of userCountryNames()) {
      streetPart = stripTrailingComponent(streetPart, name);
    }

    const parts: string[] = [streetPart];
    if (cityPart && !containsComponent(streetPart, cityPart)) {
      parts.push(cityPart);
    }
    if (
      countryPart &&
      !matchesUserCountry(countryPart) &&
      !containsComponent(streetPart, countryPart)
    ) {
      parts.push(countryPart);
    }
    const joined = parts.filter(Boolean).join(', ');
    return joined || null;
  }

  const parts: string[] = [];
  if (cityPart) parts.push(cityPart);
  if (countryPart && !matchesUserCountry(countryPart)) {
    parts.push(countryPart);
  }
  return parts.length ? parts.join(', ') : null;
}

export function draftAddressLine(draft: RestaurantDraft): string | null {
  return formatAddressLine({
    street: draft.streetAddress,
    city: draft.city,
    country: draft.country,
  });
}
