import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database, SmartCityClient } from '@smart-city/api';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from './env';
import { ensureWebCrypto } from './web-crypto';

let client: SmartCityClient | null = null;

/**
 * Returns the singleton Supabase client, created lazily on first use.
 * Throws a descriptive error when the project is not configured, instead of
 * silently talking to a non-existent backend.
 */
export function getSupabase(): SmartCityClient {
  if (client) return client;
  if (!isSupabaseConfigured || !env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error(
      'Supabase is not configured. Copy apps/mobile/.env.example to apps/mobile/.env and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  // Must run before createClient: Supabase's PKCE helpers read the global crypto at call time
  // and would otherwise fall back to Math.random() and the plain challenge (Hermes has no
  // Web Crypto). Throws rather than continue insecurely.
  ensureWebCrypto();

  client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      // AsyncStorage is used on web too only when rendering in a browser; during static
      // rendering there is no window, so fall back to the default (in-memory) storage.
      ...(Platform.OS !== 'web' || typeof window !== 'undefined' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      // Email links are handled by the auth/callback screen, which exchanges the PKCE code.
      // The code verifier is kept in the same storage, so a link opened after an app restart
      // still works on this device.
      detectSessionInUrl: false,
      flowType: 'pkce',
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
