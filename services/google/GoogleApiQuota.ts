/**
 * Client-side soft/hard daily quotas for Google API kinds.
 * Soft: one warning per kind per day, call still proceeds.
 * Hard: block before the network request. Bypassable via Settings reset / __DEV__.
 */
import { houseAlert } from '@/components/ui/HouseAlert';
import { i18n } from '@/i18n';
import {
  getGoogleApiUsageSnapshot,
  hydrateGoogleApiTracker,
  type GoogleApiKind,
} from '@/services/google/GoogleApiTracker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoogleApiQuotaLimits = {
  soft: number | null;
  hard: number;
};

const DEV_LIMIT = 9999;

const PRODUCTION_LIMITS: Record<GoogleApiKind, GoogleApiQuotaLimits> = {
  places: { soft: 80, hard: 150 },
  gemini: { soft: 15, hard: 30 },
  maps: { soft: null, hard: 100 },
};

function softWarningDayKey(kind: GoogleApiKind): string {
  return `google_api_${kind}_soft_warn_day`;
}

function currentDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getGoogleApiQuotaLimits(
  kind: GoogleApiKind,
): GoogleApiQuotaLimits {
  if (__DEV__) {
    return { soft: null, hard: DEV_LIMIT };
  }
  return PRODUCTION_LIMITS[kind];
}

export function todayCountForKind(kind: GoogleApiKind): number {
  const snap = getGoogleApiUsageSnapshot();
  if (kind === 'places') return snap.placesToday;
  if (kind === 'gemini') return snap.geminiToday;
  return snap.mapsToday;
}

export class GoogleApiQuotaExceededError extends Error {
  readonly kind: GoogleApiKind;

  constructor(kind: GoogleApiKind, message: string) {
    super(message);
    this.name = 'GoogleApiQuotaExceededError';
    this.kind = kind;
  }
}

export function isGoogleApiQuotaExceededError(
  error: unknown,
): error is GoogleApiQuotaExceededError {
  return error instanceof GoogleApiQuotaExceededError;
}

async function softWarningAlreadyShownToday(
  kind: GoogleApiKind,
): Promise<boolean> {
  const stored = await AsyncStorage.getItem(softWarningDayKey(kind));
  return stored === currentDayKey();
}

async function markSoftWarningShownToday(kind: GoogleApiKind): Promise<void> {
  await AsyncStorage.setItem(softWarningDayKey(kind), currentDayKey());
}

/** Clear soft-warning timestamps (also cleared by resetGoogleApiCounters). */
export async function clearGoogleApiSoftWarnings(): Promise<void> {
  await AsyncStorage.multiRemove([
    softWarningDayKey('places'),
    softWarningDayKey('gemini'),
    softWarningDayKey('maps'),
  ]);
}

/**
 * Gate a Google API call. Shows soft warning at most once/day/kind.
 * Throws {@link GoogleApiQuotaExceededError} when hard limit is reached.
 */
export async function assertGoogleApiAllowed(
  kind: GoogleApiKind,
): Promise<void> {
  await hydrateGoogleApiTracker();
  const limits = getGoogleApiQuotaLimits(kind);
  const today = todayCountForKind(kind);

  if (today >= limits.hard) {
    const title = i18n.t(`apiQuota.${kind}.hardTitle`);
    const message = i18n.t(`apiQuota.${kind}.hardMessage`);
    houseAlert(title, message);
    throw new GoogleApiQuotaExceededError(kind, message);
  }

  if (limits.soft != null && today >= limits.soft) {
    if (!(await softWarningAlreadyShownToday(kind))) {
      await markSoftWarningShownToday(kind);
      houseAlert(
        i18n.t(`apiQuota.${kind}.softTitle`),
        i18n.t(`apiQuota.${kind}.softMessage`),
      );
    }
  }
}
