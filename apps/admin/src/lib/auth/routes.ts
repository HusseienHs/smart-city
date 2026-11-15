import { isSupportedLocale, type Locale } from '@smart-city/shared';

import { localeFromPathname, localizedHref, stripLocale } from '@/lib/i18n/routing';

/**
 * Which pages need what, by path without the locale prefix. Pure, so the proxy, pages and
 * tests share one definition.
 *
 * - `public`: reachable signed out (sign-in, password reset, the email-link callback).
 * - `session`: needs a signed-in user, not a staff membership (invitations / no-access).
 * - `dashboard`: everything else; needs a signed-in user with staff access.
 */
export type RouteArea = 'public' | 'session' | 'dashboard';

export const SIGN_IN_PATH = '/sign-in';
export const FORGOT_PASSWORD_PATH = '/forgot-password';
export const RESET_PASSWORD_PATH = '/reset-password';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const ACCESS_PATH = '/access';
/** Staff registration for invited people (creates an account; grants nothing by itself). */
export const JOIN_PATH = '/join';

const PUBLIC_PATHS: readonly string[] = [
  SIGN_IN_PATH,
  FORGOT_PASSWORD_PATH,
  // Without a recovery session the page itself explains that the link can't be used.
  RESET_PASSWORD_PATH,
  AUTH_CALLBACK_PATH,
  JOIN_PATH,
];
const SESSION_PATHS: readonly string[] = [ACCESS_PATH];

const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function routeArea(path: string): RouteArea {
  if (PUBLIC_PATHS.some((base) => matches(path, base))) return 'public';
  if (SESSION_PATHS.some((base) => matches(path, base))) return 'session';
  return 'dashboard';
}

/** Why the sign-in page was opened, shown as a notice above the form. */
export type SignInNotice = 'session' | 'signed-out' | 'link';

export function isSignInNotice(value: unknown): value is SignInNotice {
  return value === 'session' || value === 'signed-out' || value === 'link';
}

/** The sign-in page, remembering where to return to. */
export function signInHref(locale: Locale, next?: string, notice?: SignInNotice) {
  const params = new URLSearchParams();
  if (next) params.set('next', next);
  if (notice) params.set('notice', notice);
  const query = params.toString();
  return `${localizedHref(locale, SIGN_IN_PATH)}${query ? `?${query}` : ''}`;
}

export type ProxyDecision = { type: 'continue' } | { type: 'redirect'; to: string };

/**
 * The proxy's OPTIMISTIC check, made before rendering: signed-out visitors are sent to
 * sign-in (remembering the page), signed-in users skip the sign-in page. It only looks at
 * whether a verified session exists. Staff membership and roles are checked server-side by
 * the pages themselves, and the database enforces access on every query regardless.
 *
 * `pathname` must already carry a locale prefix; `search` includes the leading `?`.
 */
export function proxyDecision(pathname: string, search: string, signedIn: boolean): ProxyDecision {
  const locale = localeFromPathname(pathname);
  if (!locale) return { type: 'continue' };
  const path = stripLocale(pathname);
  const area = routeArea(path);

  if (!signedIn && area !== 'public') {
    return { type: 'redirect', to: signInHref(locale, `${pathname}${search}`) };
  }
  if (signedIn && path === SIGN_IN_PATH) {
    const params = new URLSearchParams(search);
    return { type: 'redirect', to: safeNextPath(params.get('next'), locale) };
  }
  return { type: 'continue' };
}

const ORIGIN = 'http://smart-city.invalid';

/**
 * Where to go after signing in. Only a same-site, locale-prefixed dashboard or access path is
 * accepted (never another origin, a protocol-relative `//host` URL or a public auth page);
 * anything else falls back to the dashboard home. Prevents open redirects.
 */
export function safeNextPath(next: string | null | undefined, locale: Locale): string {
  const fallback = localizedHref(locale, '/');
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\s]/.test(next)) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(next, ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== ORIGIN) return fallback;
  const prefix = localeFromPathname(url.pathname);
  if (!prefix || !isSupportedLocale(prefix)) return fallback;
  const path = stripLocale(url.pathname);
  if (NO_RETURN_PATHS.some((base) => path === base || path.startsWith(`${base}/`))) {
    return fallback;
  }
  return `${url.pathname}${url.search}`;
}

/**
 * Pages never returned to after signing in or following an email link: returning there would
 * loop. (The password-reset page is a valid destination — it is where reset links lead.)
 */
const NO_RETURN_PATHS: readonly string[] = [
  SIGN_IN_PATH,
  FORGOT_PASSWORD_PATH,
  AUTH_CALLBACK_PATH,
  JOIN_PATH,
];
