/**
 * Human-readable labels for Google Places `primaryType`
 * (Swift `PlaceTypeLabels`).
 */

const KNOWN_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  bakery: 'Bakery',
  bar: 'Bar',
  pub: 'Pub',
  meal_takeaway: 'Takeaway',
  meal_delivery: 'Delivery',
  fast_food_restaurant: 'Fast food',
  pizza_restaurant: 'Pizza restaurant',
  italian_restaurant: 'Italian restaurant',
  chinese_restaurant: 'Chinese restaurant',
  japanese_restaurant: 'Japanese restaurant',
  sushi_restaurant: 'Sushi restaurant',
  indian_restaurant: 'Indian restaurant',
  thai_restaurant: 'Thai restaurant',
  mexican_restaurant: 'Mexican restaurant',
  french_restaurant: 'French restaurant',
  greek_restaurant: 'Greek restaurant',
  spanish_restaurant: 'Spanish restaurant',
  turkish_restaurant: 'Turkish restaurant',
  seafood_restaurant: 'Seafood restaurant',
  steak_house: 'Steakhouse',
  hamburger_restaurant: 'Burger restaurant',
  vegan_restaurant: 'Vegan restaurant',
  vegetarian_restaurant: 'Vegetarian restaurant',
  brunch_restaurant: 'Brunch restaurant',
  breakfast_restaurant: 'Breakfast restaurant',
  fine_dining_restaurant: 'Fine dining',
  sandwich_shop: 'Sandwich shop',
  ice_cream_shop: 'Ice cream shop',
  coffee_shop: 'Coffee shop',
  tea_house: 'Tea house',
  wine_bar: 'Wine bar',
  food_court: 'Food court',
  deli: 'Deli',
  snack_bar: 'Snack bar',
  american_restaurant: 'American restaurant',
  mediterranean_restaurant: 'Mediterranean restaurant',
  middle_eastern_restaurant: 'Middle Eastern restaurant',
  korean_restaurant: 'Korean restaurant',
  vietnamese_restaurant: 'Vietnamese restaurant',
  indonesian_restaurant: 'Indonesian restaurant',
  belgian_restaurant: 'Belgian restaurant',
};

function humanize(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function placeTypeDisplayName(rawType: string): string {
  const key = rawType.trim();
  if (!key) return 'Unknown type';
  return KNOWN_LABELS[key] ?? humanize(key);
}

/** Sort raw types by display name (A–Z). */
export function sortedPlaceTypes(rawTypes: string[]): string[] {
  return [...rawTypes].sort((a, b) =>
    placeTypeDisplayName(a).localeCompare(placeTypeDisplayName(b), undefined, {
      sensitivity: 'base',
    }),
  );
}
