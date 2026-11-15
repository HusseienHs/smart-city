import type { Locale } from '@smart-city/shared';

import { MUNICIPAL_TIME_ZONE } from './filters';

/** Dates and times in the municipality's time zone, in the dashboard language. */
export function formatDateTime(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: MUNICIPAL_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: MUNICIPAL_TIME_ZONE,
  }).format(new Date(iso));
}

/** Coordinates with ~1 m precision, always with Western digits and a dot (they are data). */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}
