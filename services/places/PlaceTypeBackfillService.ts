import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Restaurant } from '@/data/types';
import { fetchPrimaryType } from '@/services/places/RestaurantSearchService';

const FAILED_IDS_KEY = 'gustra.placeTypeBackfill.failedPlaceIDs.v1';
const MAX_PER_LAUNCH = 15;
const DELAY_MS = 400;

export type PrimaryTypeBackfillUpdate = {
  restaurantId: string;
  primaryType: string;
};

function normalizedPlaceID(raw: string | null | undefined): string | null {
  let value = (raw ?? '').trim();
  if (!value) return null;
  if (value.startsWith('places/')) {
    value = value.slice('places/'.length);
  }
  return value || null;
}

async function loadFailedIDs(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FAILED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveFailedIDs(ids: Set<string>): Promise<void> {
  const capped = [...ids].sort().slice(0, 500);
  await AsyncStorage.setItem(FAILED_IDS_KEY, JSON.stringify(capped));
}

/**
 * Silently fills missing `Restaurant.primaryType` via Place Details
 * (Swift `PlaceTypeBackfillService`). Batched at launch to limit quota.
 * Returns updates for the caller to persist in one write.
 */
export async function backfillMissingPrimaryTypes(
  restaurants: Restaurant[],
): Promise<PrimaryTypeBackfillUpdate[]> {
  const failedIDs = await loadFailedIDs();
  const candidates = restaurants.filter((restaurant) => {
    const placeID = normalizedPlaceID(restaurant.mapItemIdentifier);
    return (
      !restaurant.primaryType.trim() &&
      placeID != null &&
      !failedIDs.has(placeID)
    );
  });

  if (candidates.length === 0) return [];

  const updatedFailed = new Set(failedIDs);
  const updates: PrimaryTypeBackfillUpdate[] = [];

  for (const restaurant of candidates.slice(0, MAX_PER_LAUNCH)) {
    const placeID = normalizedPlaceID(restaurant.mapItemIdentifier);
    if (!placeID) continue;

    try {
      const primaryType = await fetchPrimaryType(placeID);
      if (primaryType) {
        updates.push({ restaurantId: restaurant.id, primaryType });
      } else {
        updatedFailed.add(placeID);
      }
    } catch {
      updatedFailed.add(placeID);
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  if (
    updatedFailed.size !== failedIDs.size ||
    [...updatedFailed].some((id) => !failedIDs.has(id))
  ) {
    await saveFailedIDs(updatedFailed);
  }

  return updates;
}
