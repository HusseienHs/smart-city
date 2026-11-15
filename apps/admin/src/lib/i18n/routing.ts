import { isSupportedLocale, resolveLocale, type Locale } from '@smart-city/shared';

/**
 * Locale routing for the admin dashboard. Every page lives under `/{locale}/…`
 * (`/he/reports`, `/ar/reports`, `/en/reports`), so the language — and with it the text
 * direction — is part of the URL: links can be shared, and each locale renders statically.
 *
 * Pure functions only, safe in the proxy, Server Components and Client Components.
 */

/** Remembers the language a staff member picked, so a bare URL opens in that language. */
export const LOCALE_COOKIE = 'sc_admin_locale';
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The locale prefix of a pathname (`/ar/reports` → `ar`), or null when there is none. */
export function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/')[1];
  return isSupportedLocale(segment) ? segment : null;
}

/** The pathname without its locale prefix: `/he/reports` → `/reports`, `/he` → `/`. */
export function stripLocale(pathname: string): string {
  const locale = localeFromPathname(pathname);
  if (!locale) return pathname || '/';
  const rest = pathname.slice(locale.length + 1);
  return rest === '' ? '/' : rest;
}

/** An app path in the given locale: (`he`, `/reports`) → `/he/reports`, (`he`, `/`) → `/he`. */
export function localizedHref(locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`;
}

/** The same page in another language: (`/he/reports`, `en`) → `/en/reports`. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  return localizedHref(locale, stripLocale(pathname));
}

/** Language tags from an Accept-Language header, most preferred first. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const quality = q === undefined ? 1 : Number(q.slice(2));
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag !== '' && entry.tag !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.tag);
}

export interface LocalePreferences {
  /** The value of the locale cookie, if any. */
  cookie?: string | null;
  /** The request's Accept-Language header, if any. */
  acceptLanguage?: string | null;
}

/** The saved choice first, then the browser's languages, then Hebrew. */
export function preferredLocale({ cookie, acceptLanguage }: LocalePreferences): Locale {
  if (isSupportedLocale(cookie)) return cookie;
  return resolveLocale(parseAcceptLanguage(acceptLanguage));
}

/**
 * Where a request for `pathname` should be redirected so that it carries a locale prefix,
 * or null when it already does.
 */
export function localeRedirect(pathname: string, preferences: LocalePreferences): string | null {
  if (localeFromPathname(pathname)) return null;
  return localizedHref(preferredLocale(preferences), pathname);
}
