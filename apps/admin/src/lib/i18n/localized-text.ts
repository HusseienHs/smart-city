import type { LocalizedText, Locale } from '@smart-city/shared';

/**
 * A database name (municipality, department, …) in the given language. Hebrew is the only
 * language the database guarantees, so it is the fallback for a missing or empty translation.
 */
export function localizedText(text: LocalizedText, locale: Locale): string {
  return text[locale]?.trim() || text.he;
}
