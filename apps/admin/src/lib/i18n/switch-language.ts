import type { Locale } from '@smart-city/shared';

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS, switchLocalePath } from './routing';

/**
 * Browser only. Remembers `locale` as the staff member's language and reloads the current
 * page in it (same path, query and hash).
 *
 * This is deliberately a full page load rather than a client-side transition: the document's
 * `lang` and `dir` attributes change with the locale, and every server-rendered string must be
 * rendered again in the new language.
 */
export function switchLanguage(locale: Locale, pathname: string): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  const { search, hash } = window.location;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload intended (see above)
  window.location.assign(`${switchLocalePath(pathname, locale)}${search}${hash}`);
}
