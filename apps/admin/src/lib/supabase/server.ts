import 'server-only';

import type { Database, SmartCityClient } from '@smart-city/api';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connection } from 'next/server';

import { requireSupabaseConfig } from '@/lib/env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the user's session cookies — it acts as the signed-in user, so RLS applies.
 * Create a new client per request; never share one between users.
 */
export async function createSupabaseServerClient(): Promise<SmartCityClient> {
  const { url, key } = requireSupabaseConfig();
  // The auth client reads the clock (Date.now) to check token expiry. A prefetch prerender can
  // see cookies but must not read the clock, so defer everything that uses the client to the
  // real request. Its data is per user and never part of a prerender anyway.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. Safe to ignore:
          // the proxy (src/proxy.ts) refreshes the session before any page renders.
        }
      },
    },
  });
}
