import { i18n } from '@/i18n';
import {
  isAppLanguage,
  resolveIntlLocale,
  type AppLanguage,
} from '@/i18n/resolveLanguage';

/** Active app language → BCP-47 tag for `Intl` date formatting. */
export function activeIntlLocale(): string {
  const raw = (i18n.language ?? 'en').split('-')[0]?.toLowerCase() ?? 'en';
  const language: AppLanguage = isAppLanguage(raw) ? raw : 'en';
  return resolveIntlLocale(language);
}

/**
 * Floor a date's time-of-day down to the nearest half hour (20:42 → 20:30,
 * seconds/ms zeroed). Visit times in the review form always round down so the
 * picker only ever settles on :00 / :30.
 */
export function floorToHalfHour(date: Date): Date {
  const floored = new Date(date.getTime());
  floored.setMinutes(Math.floor(floored.getMinutes() / 30) * 30, 0, 0);
  return floored;
}

/** Full review date/time (e.g. review detail). */
export function formatReviewDateTime(
  iso: string,
  intlLocale: string = activeIntlLocale(),
): string {
  return new Date(iso).toLocaleString(intlLocale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Abbreviated date for feed / visit summaries. */
export function formatAbbreviatedDate(
  iso: string,
  intlLocale: string = activeIntlLocale(),
): string {
  return new Date(iso).toLocaleDateString(intlLocale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Long calendar date (e.g. visit row). */
export function formatLongDate(
  iso: string,
  intlLocale: string = activeIntlLocale(),
): string {
  return new Date(iso).toLocaleDateString(intlLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Visit date picker label with weekday + time. */
export function formatVisitDateTime(
  date: Date,
  intlLocale: string = activeIntlLocale(),
): string {
  return date.toLocaleString(intlLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
