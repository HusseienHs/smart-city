export const SUPPORTED_LOCALES = ['he', 'ar', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Hebrew is the primary market language. */
export const DEFAULT_LOCALE: Locale = 'he';

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['he', 'ar']);

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

export function getTextDirection(locale: Locale): 'rtl' | 'ltr' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * Picks the best supported locale from an ordered list of preferences
 * (e.g. device locales or the Accept-Language header). Matches on language subtag,
 * so `he-IL` → `he`. Legacy `iw` is treated as Hebrew.
 */
export function resolveLocale(preferred: readonly (string | null | undefined)[]): Locale {
  for (const tag of preferred) {
    if (!tag) continue;
    const language = tag.toLowerCase().split(/[-_]/)[0];
    const normalized = language === 'iw' ? 'he' : language;
    if (isSupportedLocale(normalized)) return normalized;
  }
  return DEFAULT_LOCALE;
}
