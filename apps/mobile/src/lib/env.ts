import { z } from 'zod';

/**
 * Public (client-bundled) configuration. Only `EXPO_PUBLIC_*` variables are inlined by Expo,
 * and each must be referenced statically (`process.env.EXPO_PUBLIC_X`) to be inlined.
 * Never put secrets here: everything in this file ships inside the app binary.
 */
const envSchema = z.object({
  supabaseUrl: z.url().optional(),
  supabasePublishableKey: z.string().min(1).optional(),
  mapProvider: z.enum(['none', 'google', 'mapbox']).default('none'),
});

const parsed = envSchema.safeParse({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || undefined,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  mapProvider: process.env.EXPO_PUBLIC_MAP_PROVIDER || undefined,
});

if (!parsed.success) {
  console.error('Invalid mobile environment configuration', z.treeifyError(parsed.error));
}

export const env = parsed.success ? parsed.data : envSchema.parse({});

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
