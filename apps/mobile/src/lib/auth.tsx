import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SignInInput, SignUpInput } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import type { Session, User } from '@supabase/supabase-js';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import {
  checkAuthRedirect,
  devRedirectError,
  type AppRuntime,
  type AuthRedirectInfo,
} from './auth-redirect';
import {
  AUTH_CALLBACK_PATH,
  authErrorKey,
  isPreviewAllowed,
  signUpMetadata,
  type AuthCallbackParams,
} from './auth-utils';
import { isSupabaseConfigured } from './env';
import {
  clearPasswordRecovery,
  markPasswordRecovery,
  restoreAuthState,
} from './password-recovery-state';
import { getSupabase } from './supabase';

/**
 * Development-only way into the app without an account, so screens (e.g. the mock report
 * flow) can be reviewed with or without Supabase configured. It sets a local flag only: no
 * Supabase session is created, and nothing is sent. `process.env.NODE_ENV` is inlined at build
 * time, so production builds compile this to `false`.
 */
export const canUsePreview = isPreviewAllowed(process.env.NODE_ENV);

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been restored on startup. */
  isLoading: boolean;
  /**
   * Signed in through a password-recovery link: the user must choose a new password before
   * the rest of the app opens. Persisted, so it survives closing the app.
   */
  isRecoveringPassword: boolean;
  finishPasswordRecovery: () => void;
  /** Browsing in dev preview mode: there is no account and no session. Never set together
   * with a real session. */
  isPreview: boolean;
  enterPreview: () => void;
  exitPreview: () => void;
  /** The user signed out (or left preview) in this app session: land on sign-in, not sign-up. */
  hasSignedOut: boolean;
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
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [hasSignedOut, setHasSignedOut] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();

    // Restore the session and whether it still owes a new password. The root layout renders
    // nothing while isLoading is true, so routing starts only once both are known.
    restoreAuthState(() => supabase.auth.getSession(), AsyncStorage)
      .then((restored) => {
        setIsRecoveringPassword(restored.isRecoveringPassword);
        setSession(restored.session);
      })
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Fired when a recovery link's code is exchanged (see completeAuthCallback).
      if (event === 'PASSWORD_RECOVERY' && next) {
        setIsRecoveringPassword(true);
        void markPasswordRecovery(AsyncStorage, next.user.id);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecoveringPassword(false);
        setHasSignedOut(true);
        void clearPasswordRecovery(AsyncStorage);
      }
      // A real session (sign-in, email link) always replaces dev preview mode.
      if (next) setIsPreview(false);
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isRecoveringPassword,
      finishPasswordRecovery: () => {
        setIsRecoveringPassword(false);
        void clearPasswordRecovery(AsyncStorage);
      },
      isPreview,
      enterPreview: () => {
        if (canUsePreview) setIsPreview(true);
      },
      exitPreview: () => {
        setIsPreview(false);
        setHasSignedOut(true);
      },
      hasSignedOut,
    }),
    [session, isLoading, isRecoveringPassword, isPreview, hasSignedOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/**
 * Where email links send the user. Built at runtime, so it is correct everywhere:
 * `exp://<computer-ip>:<port>/--/auth/callback` in Expo Go (`exps://…` with a tunnel),
 * `smartcity://auth/callback` in builds and `<origin>/auth/callback` on the web. Each must be
 * allowed in Supabase (Authentication → URL Configuration → Redirect URLs). A link only works
 * on the device that requested it (PKCE). Checked in development by authRedirectInfo().
 */
export function authRedirectUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/** Where this app is running, which decides the redirect scheme it can receive. */
export function appRuntime(): AppRuntime {
  if (Platform.OS === 'web') return 'web';
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? 'expo-go'
    : 'native-build';
}

/** The redirect for this device, checked against the runtime (see auth-redirect.ts). */
export function authRedirectInfo(): AuthRedirectInfo {
  return checkAuthRedirect(authRedirectUrl(), appRuntime());
}

/**
 * Development only: refuses to send an email whose link could not open this app on this device
 * (it would fail later, after the user opened it). Returns the redirect to use, or the error.
 * Outside development nothing is checked, so production behavior is unchanged.
 */
function redirectForEmail(): { url: string } | { error: MessageKey } {
  const info = authRedirectInfo();
  const error = devRedirectError(info, process.env.NODE_ENV);
  if (!error) return { url: info.url };
  // Development-only diagnostic for the developer.
  console.warn(`[auth] email redirect "${info.url}" can't open this app (${info.problem}).`);
  return { error };
}

export type AuthResult = { ok: true } | { ok: false; error: MessageKey };

async function run(action: () => Promise<{ error: unknown }>): Promise<AuthResult> {
  try {
    const { error } = await action();
    return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: authErrorKey(error) };
  }
}

export function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  return run(() => getSupabase().auth.signInWithPassword({ email, password }));
}

/**
 * Creates the account. `full_name` and `preferred_locale` are copied into `public.profiles`
 * by the `handle_new_user` database trigger. With email confirmation enabled (required for
 * staff invitations) there is no session yet: the user must confirm their email first.
 */
export async function signUp(
  input: SignUpInput,
): Promise<AuthResult & { needsConfirmation?: boolean }> {
  const redirect = redirectForEmail();
  if ('error' in redirect) return { ok: false, error: redirect.error };
  try {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: signUpMetadata(input), emailRedirectTo: redirect.url },
    });
    if (error) return { ok: false, error: authErrorKey(error) };
    return { ok: true, needsConfirmation: !data.session };
  } catch (error) {
    return { ok: false, error: authErrorKey(error) };
  }
}

/** Sends the sign-up confirmation email again. */
export async function resendVerification(email: string): Promise<AuthResult> {
  const redirect = redirectForEmail();
  if ('error' in redirect) return { ok: false, error: redirect.error };
  return run(() =>
    getSupabase().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirect.url },
    }),
  );
}

/**
 * Sends a password-reset link. Supabase answers the same way whether or not the account
 * exists, so this never reveals which emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const redirect = redirectForEmail();
  if ('error' in redirect) return { ok: false, error: redirect.error };
  return run(() => getSupabase().auth.resetPasswordForEmail(email, { redirectTo: redirect.url }));
}

/** Sets a new password for the signed-in user (after a recovery link). */
export function updatePassword(password: string): Promise<AuthResult> {
  return run(() => getSupabase().auth.updateUser({ password }));
}

/**
 * Finishes an email link: exchanges the PKCE code for a session. A recovery link also fires
 * `PASSWORD_RECOVERY`, which the provider turns into `isRecoveringPassword`.
 */
export async function completeAuthCallback(params: AuthCallbackParams): Promise<AuthResult> {
  if (params.error || params.errorCode) {
    return {
      ok: false,
      error:
        params.errorCode === 'otp_expired' ? 'auth.errors.linkExpired' : 'auth.errors.linkInvalid',
    };
  }
  const code = params.code;
  if (!code) return { ok: false, error: 'auth.errors.linkInvalid' };
  return run(() => getSupabase().auth.exchangeCodeForSession(code));
}

/**
 * Ends the session. Without a connection the server-side sign-out fails; the session is then
 * still removed from this device. Only if that also fails is an error returned.
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (!error) return { ok: true };
    const local = await getSupabase().auth.signOut({ scope: 'local' });
    return local.error ? { ok: false, error: authErrorKey(local.error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: authErrorKey(error) };
  }
}
