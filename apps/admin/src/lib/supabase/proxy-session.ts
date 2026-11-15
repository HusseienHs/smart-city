import type { Database } from '@smart-city/api';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { requireSupabaseConfig } from '@/lib/env';

/**
 * Refreshes the Supabase session for this request (Supabase SSR + Next.js proxy pattern).
 *
 * `getClaims()` verifies the access token's signature and, when it has expired, uses the
 * refresh token to obtain a new one. The new cookies are written both to the request (so the
 * page rendered for this request sees them) and to the response (so the browser keeps them).
 * The cache headers Supabase supplies with refreshed cookies (`Cache-Control: private,
 * no-store`, …) are copied too, so no shared cache ever stores a response carrying a session.
 */
export async function refreshSession(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  const { url, key } = requireSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Nothing may run between creating the client and this call: it is what refreshes the session.
  const { data, error } = await supabase.auth.getClaims();
  const userId = !error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
  return { response, userId };
}

/** A redirect that keeps any refreshed session cookies and cache headers of `from`. */
export function redirectKeepingSession(to: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(to);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
