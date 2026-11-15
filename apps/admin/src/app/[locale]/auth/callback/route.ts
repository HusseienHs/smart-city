import { exchangeAuthCode, readAuthCallback } from '@smart-city/api';
import { DEFAULT_LOCALE, isSupportedLocale } from '@smart-city/shared';
import { NextResponse, type NextRequest } from 'next/server';

import { safeNextPath, signInHref } from '@/lib/auth/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Where email links land (password reset). Exchanges the PKCE code for a session on the server:
 * the code only works together with the verifier cookie set in the browser that requested the
 * email, so a link forwarded to someone else signs no one in. Tokens in a URL fragment are never
 * used (they don't reach the server, and aren't bound to this browser).
 *
 * `next` is followed only if it is a same-site dashboard path; failures go to sign-in with a
 * neutral "link can't be used" notice.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/[locale]/auth/callback'>,
) {
  const { locale: requested } = await params;
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  const query = Object.fromEntries(request.nextUrl.searchParams);
  const callback = readAuthCallback(query, null);

  if (callback.kind === 'code') {
    try {
      await exchangeAuthCode(await createSupabaseServerClient(), callback.code);
      const next = safeNextPath(request.nextUrl.searchParams.get('next'), locale);
      return NextResponse.redirect(new URL(next, request.url));
    } catch {
      // Expired, already used, or opened in another browser: fall through.
    }
  }
  return NextResponse.redirect(new URL(signInHref(locale, undefined, 'link'), request.url));
}
