import type { SignInInput, SignUpInput } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import {
  isAuthError,
  isAuthRetryableFetchError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { isSupabaseConfigured } from './env';
import { getSupabase } from './supabase';

/**
 * Development-only way into the app while no backend is configured, so screens can be
 * reviewed before Supabase is connected. Never available in production builds.
 */
export const canUsePreview = __DEV__ && !isSupabaseConfigured;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been restored on startup. */
  isLoading: boolean;
  /** Browsing in dev preview mode: there is no account and no session. */
  isPreview: boolean;
  enterPreview: () => void;
  exitPreview: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Tracks the signed-in user. The session is restored from AsyncStorage on startup and kept
 * up to date by Supabase's auth listener. Without a configured backend the user is always
 * signed out.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isPreview,
      enterPreview: () => {
        if (canUsePreview) setIsPreview(true);
      },
      exitPreview: () => setIsPreview(false),
    }),
    [session, isLoading, isPreview],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Maps Supabase auth errors to a translated message. Unknown errors get a generic one. */
function authErrorKey(error: unknown): MessageKey {
  if (isAuthRetryableFetchError(error)) return 'auth.errors.network';
  if (!isAuthError(error)) return 'auth.errors.unknown';
  switch (error.code) {
    case 'invalid_credentials':
      return 'auth.errors.invalidCredentials';
    case 'email_not_confirmed':
      return 'auth.errors.emailNotConfirmed';
    case 'user_already_exists':
      return 'auth.errors.userExists';
    case 'weak_password':
      return 'auth.errors.weakPassword';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'auth.errors.rateLimited';
    default:
      return 'auth.errors.unknown';
  }
}

export type AuthResult = { ok: true } | { ok: false; error: MessageKey };

export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: authErrorKey(error) };
  }
}

/**
 * Creates the account. `full_name` and `preferred_locale` are copied into `public.profiles`
 * by the `handle_new_user` database trigger. With email confirmation enabled (required for
 * staff invitations) there is no session yet: the user must confirm their email first.
 */
export async function signUp({
  email,
  password,
  fullName,
  preferredLocale,
}: SignUpInput): Promise<AuthResult & { needsConfirmation?: boolean }> {
  try {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, preferred_locale: preferredLocale } },
    });
    if (error) return { ok: false, error: authErrorKey(error) };
    return { ok: true, needsConfirmation: !data.session };
  } catch (error) {
    return { ok: false, error: authErrorKey(error) };
  }
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}
