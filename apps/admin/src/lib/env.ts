import { z } from 'zod';

/**
 * Public configuration, inlined into the browser bundle at build time.
 * `NEXT_PUBLIC_*` variables must be referenced statically to be inlined.
 */
const publicEnvSchema = z.object({
  supabaseUrl: z.url().optional(),
  supabasePublishableKey: z.string().min(1).optional(),
  mapProvider: z.enum(['none', 'google', 'mapbox']).default('none'),
});

const parsed = publicEnvSchema.safeParse({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  mapProvider: process.env.NEXT_PUBLIC_MAP_PROVIDER || undefined,
});

if (!parsed.success) {
  console.error('Invalid admin environment configuration', z.treeifyError(parsed.error));
}

export const publicEnv = parsed.success ? parsed.data : publicEnvSchema.parse({});

export const isSupabaseConfigured = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabasePublishableKey,
);

export function requireSupabaseConfig(): { url: string; key: string } {
  const { supabaseUrl, supabasePublishableKey } = publicEnv;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Supabase is not configured. Copy apps/admin/.env.example to apps/admin/.env.local and set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return { url: supabaseUrl, key: supabasePublishableKey };
}
