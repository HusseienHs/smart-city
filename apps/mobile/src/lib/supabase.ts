import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from './env';

let client: SupabaseClient | null = null;

/**
 * Returns the singleton Supabase client, created lazily on first use.
 * Throws a descriptive error when the project is not configured, instead of
 * silently talking to a non-existent backend.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!isSupabaseConfigured || !env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error(
      'Supabase is not configured. Copy apps/mobile/.env.example to apps/mobile/.env and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      // AsyncStorage is used on web too only when rendering in a browser; during static
      // rendering there is no window, so fall back to the default (in-memory) storage.
      ...(Platform.OS !== 'web' || typeof window !== 'undefined' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Only refresh tokens while the app is in the foreground (recommended by Supabase for RN).
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }

  return client;
}
