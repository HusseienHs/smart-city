import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseConfig } from '@/lib/env';

/** Supabase client for Client Components. Acts as the signed-in user; RLS applies. */
export function createSupabaseBrowserClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient(url, key);
}
