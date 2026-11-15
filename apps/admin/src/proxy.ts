import { NextResponse, type NextRequest } from 'next/server';

import { proxyDecision } from '@/lib/auth/routes';
import { isSupabaseConfigured } from '@/lib/env';
import { LOCALE_COOKIE, localeRedirect } from '@/lib/i18n/routing';
import { redirectKeepingSession, refreshSession } from '@/lib/supabase/proxy-session';

/**
 * Runs before every page request:
 *
 * 1. Locale: requests without a locale prefix go to the staff member's language (saved
 *    choice, else the browser's language, else Hebrew). `/reports` → `/he/reports`.
 * 2. Session: refreshes the Supabase session cookies.
 * 3. Optimistic access check: signed-out visitors are sent to sign-in.
 *
 * Step 3 is only a fast path. Pages verify the session and staff membership again on the
 * server, and the database (RLS) authorizes every query — nothing relies on this proxy alone.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const localized = localeRedirect(pathname, {
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });
  if (localized) {
    const url = request.nextUrl.clone();
    url.pathname = localized;
    return NextResponse.redirect(url);
  }

  // Without a backend there is no session; the pages explain that sign-in is unavailable.
  if (!isSupabaseConfigured) return NextResponse.next();

  const { response, userId } = await refreshSession(request);
  const decision = proxyDecision(pathname, search, userId !== null);
  if (decision.type === 'redirect') {
    return redirectKeepingSession(new URL(decision.to, request.url), response);
  }
  return response;
}

export const config = {
  // Everything except Next.js internals, API routes and files with an extension (favicon, …).
  matcher: ['/((?!_next/|api/|.*\\.[\\w]+$).*)'],
};
