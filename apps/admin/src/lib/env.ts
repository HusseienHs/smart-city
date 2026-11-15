import { z } from 'zod';

/**
 * Public configuration, inlined into the browser bundle at build time.
 * `NEXT_PUBLIC_*` variables must be referenced statically to be inlined.
 *
 * Each value is validated on its own: an invalid optional setting (e.g. the map provider) is
 * reported and ignored, but never disables the Supabase connection.
 */
const supabaseUrlSchema = z.url();
const supabaseKeySchema = z.string().min(1);
const mapProviderSchema = z.enum(['none', 'google', 'mapbox']);

function read<S extends z.ZodType>(
  name: string,
  schema: S,
  value: string | undefined,
): z.output<S> | undefined {
  if (!value) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  console.error(`Invalid admin environment variable ${name}; it is ignored.`);
  return undefined;
}

export const publicEnv = {
  supabaseUrl: read(
    'NEXT_PUBLIC_SUPABASE_URL',
    supabaseUrlSchema,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: read(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    supabaseKeySchema,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  mapProvider:
    read('NEXT_PUBLIC_MAP_PROVIDER', mapProviderSchema, process.env.NEXT_PUBLIC_MAP_PROVIDER) ??
    'none',
} as const;

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
