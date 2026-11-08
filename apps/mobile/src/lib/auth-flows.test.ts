/**
 * The three authentication scenarios against a fake Supabase client: what the app sends, and
 * how it handles each answer. (The real backend is covered by manual testing on a device.)
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CALLBACK_URL = 'exp://10.0.0.5:8081/--/auth/callback';

const auth = {
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  updateUser: vi.fn(),
};

const createURL = vi.hoisted(() => vi.fn((path: string) => `exp://10.0.0.5:8081/--/${path}`));
vi.mock('expo-linking', () => ({ createURL }));
// Expo Go on a phone.
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({
  default: { executionEnvironment: 'storeClient' },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('./env', () => ({ isSupabaseConfigured: true }));
vi.mock('./supabase', () => ({ getSupabase: () => ({ auth }) }));

const {
  appRuntime,
  authRedirectInfo,
  authRedirectUrl,
  canUsePreview,
  completeAuthCallback,
  requestPasswordReset,
  resendVerification,
  signIn,
  signOut,
  signUp,
  updatePassword,
} = await import('./auth');

const ok = (data: unknown = {}) => ({ data, error: null });
const fail = (code: string, status = 400) => ({
  data: {},
  error: new AuthApiError('failure', status, code),
});

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
});

describe('configuration', () => {
  it('builds the redirect URL from the running app', () => {
    expect(authRedirectUrl()).toBe(CALLBACK_URL);
  });

  it('offers no preview outside a development build (tests run with NODE_ENV=test)', () => {
    expect(process.env.NODE_ENV).not.toBe('development');
    expect(canUsePreview).toBe(false);
  });

  it('recognizes Expo Go and accepts its redirect', () => {
    expect(appRuntime()).toBe('expo-go');
    expect(authRedirectInfo()).toMatchObject({
      url: CALLBACK_URL,
      problem: null,
      localOnly: false,
    });
  });
});

describe('development-only redirect validation', () => {
  const signUpInput = {
    fullName: 'Dana Levi',
    email: 'dana@example.com',
    password: 'correct horse battery',
    preferredLocale: 'he',
    homeMunicipalityId: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
  } as const;
  const webLink = 'http://localhost:8081/auth/callback';

  afterEach(() => {
    vi.unstubAllEnvs();
    createURL.mockReset();
    createURL.mockImplementation((path: string) => `exp://10.0.0.5:8081/--/${path}`);
  });

  it('in development, sends no email whose link could not open this app', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createURL.mockReturnValue(webLink);
    expect(await signUp(signUpInput)).toEqual({ ok: false, error: 'auth.errors.redirectInvalid' });
    expect(await resendVerification('dana@example.com')).toEqual({
      ok: false,
      error: 'auth.errors.redirectInvalid',
    });
    expect(await requestPasswordReset('dana@example.com')).toEqual({
      ok: false,
      error: 'auth.errors.redirectInvalid',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.resend).not.toHaveBeenCalled();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('in development, a correct redirect is sent unchanged', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    auth.resend.mockResolvedValue(ok());
    expect(await resendVerification('dana@example.com')).toEqual({ ok: true });
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'dana@example.com',
      options: { emailRedirectTo: CALLBACK_URL },
    });
  });

  it('outside development nothing is blocked (production behavior unchanged)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    createURL.mockReturnValue(webLink);
    auth.resend.mockResolvedValue(ok());
    expect(await resendVerification('dana@example.com')).toEqual({ ok: true });
    expect(auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ options: { emailRedirectTo: webLink } }),
    );
  });
});

describe('scenario 1: registration and email verification', () => {
  const input = {
    fullName: 'Dana Levi',
    email: 'dana@example.com',
    password: 'correct-horse',
    preferredLocale: 'he' as const,
    homeMunicipalityId: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
  };

  it('sends the profile metadata and the callback URL', async () => {
    auth.signUp.mockResolvedValue(ok({ user: { id: 'u1' }, session: null }));

    expect(await signUp(input)).toEqual({ ok: true, needsConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'dana@example.com',
      password: 'correct-horse',
      options: {
        data: {
          full_name: 'Dana Levi',
          preferred_locale: 'he',
          home_municipality_id: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
        },
        emailRedirectTo: CALLBACK_URL,
      },
    });
  });

  it('opens the app directly when email confirmation is off', async () => {
    auth.signUp.mockResolvedValue(ok({ user: { id: 'u1' }, session: { access_token: 't' } }));
    expect(await signUp(input)).toEqual({ ok: true, needsConfirmation: false });
  });

  it('reports an existing account', async () => {
    auth.signUp.mockResolvedValue(fail('user_already_exists', 422));
    expect(await signUp(input)).toEqual({ ok: false, error: 'auth.errors.userExists' });
  });

  it('resends the confirmation email to the callback URL', async () => {
    auth.resend.mockResolvedValue(ok());
    expect(await resendVerification('dana@example.com')).toEqual({ ok: true });
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'dana@example.com',
      options: { emailRedirectTo: CALLBACK_URL },
    });
  });

  it('reports the email rate limit on resend', async () => {
    auth.resend.mockResolvedValue(fail('over_email_send_rate_limit', 429));
    expect(await resendVerification('dana@example.com')).toEqual({
      ok: false,
      error: 'auth.errors.rateLimited',
    });
  });

  it('completes the confirmation link by exchanging the PKCE code', async () => {
    auth.exchangeCodeForSession.mockResolvedValue(ok({ session: {} }));
    expect(await completeAuthCallback({ code: 'pkce-code' })).toEqual({ ok: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
  });
});

describe('scenario 2: login and logout', () => {
  it('signs in with email and password', async () => {
    auth.signInWithPassword.mockResolvedValue(ok({ session: {} }));
    expect(await signIn({ email: 'dana@example.com', password: 'secret' })).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'dana@example.com',
      password: 'secret',
    });
  });

  it('maps wrong credentials and unconfirmed emails', async () => {
    auth.signInWithPassword.mockResolvedValueOnce(fail('invalid_credentials'));
    expect(await signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      error: 'auth.errors.invalidCredentials',
    });
    auth.signInWithPassword.mockResolvedValueOnce(fail('email_not_confirmed'));
    expect(await signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      error: 'auth.errors.emailNotConfirmed',
    });
  });

  it('reports network failures, including thrown ones', async () => {
    auth.signInWithPassword.mockRejectedValue(new AuthRetryableFetchError('Failed to fetch', 0));
    expect(await signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      error: 'auth.errors.network',
    });
  });

  it('signs out, and still forgets the local session when the server is unreachable', async () => {
    auth.signOut.mockResolvedValueOnce({ error: null });
    expect(await signOut()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledTimes(1);

    auth.signOut.mockReset();
    auth.signOut
      .mockResolvedValueOnce({ error: new AuthRetryableFetchError('offline', 0) })
      .mockResolvedValueOnce({ error: null });
    expect(await signOut()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
  });

  it('reports an error only when even the local sign-out fails', async () => {
    auth.signOut
      .mockResolvedValueOnce({ error: new AuthRetryableFetchError('offline', 0) })
      .mockResolvedValueOnce({ error: new AuthRetryableFetchError('storage', 0) });
    expect(await signOut()).toEqual({ ok: false, error: 'auth.errors.network' });

    auth.signOut.mockRejectedValueOnce(new Error('boom'));
    expect(await signOut()).toEqual({ ok: false, error: 'auth.errors.unknown' });
  });
});

describe('scenario 3: password recovery', () => {
  it('requests the reset link with the callback URL', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(ok());
    expect(await requestPasswordReset('dana@example.com')).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('dana@example.com', {
      redirectTo: CALLBACK_URL,
    });
  });

  it('exchanges the recovery code', async () => {
    auth.exchangeCodeForSession.mockResolvedValue(ok({ session: {} }));
    expect(await completeAuthCallback({ code: 'recovery-code' })).toEqual({ ok: true });
  });

  it('rejects expired, invalid and empty links without calling Supabase', async () => {
    expect(
      await completeAuthCallback({ error: 'access_denied', errorCode: 'otp_expired' }),
    ).toEqual({ ok: false, error: 'auth.errors.linkExpired' });
    expect(await completeAuthCallback({ error: 'server_error' })).toEqual({
      ok: false,
      error: 'auth.errors.linkInvalid',
    });
    expect(await completeAuthCallback({})).toEqual({
      ok: false,
      error: 'auth.errors.linkInvalid',
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('maps a link opened on another device', async () => {
    auth.exchangeCodeForSession.mockResolvedValue(fail('flow_state_not_found', 404));
    expect(await completeAuthCallback({ code: 'x' })).toEqual({
      ok: false,
      error: 'auth.errors.linkInvalid',
    });
  });

  it('saves the new password', async () => {
    auth.updateUser.mockResolvedValue(ok({ user: {} }));
    expect(await updatePassword('new-password-1')).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password-1' });
  });

  it('rejects reusing the current password', async () => {
    auth.updateUser.mockResolvedValue(fail('same_password', 422));
    expect(await updatePassword('old-password')).toEqual({
      ok: false,
      error: 'auth.errors.samePassword',
    });
  });
});
