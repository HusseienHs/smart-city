import { SUPPORTED_LOCALES } from '@smart-city/shared';
import { translate } from '@smart-city/shared/i18n';
import { describe, expect, it, vi } from 'vitest';

import type { SmartCityClient } from '../client';
import { ApiError } from '../errors/api-error';
import {
  exchangeAuthCode,
  requestPasswordReset,
  resendVerificationEmail,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from './auth';
import { readAuthCallback } from './auth-callback';
import { authFieldErrors, fromAuthError, invalidAuthLinkError } from './auth-errors';

const REDIRECT = 'exp://192.168.1.2:8081/--/auth/callback';
const NO_ERROR = { data: {}, error: null };

function fakeAuth(overrides: Record<string, unknown> = {}) {
  const auth = {
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue(NO_ERROR),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resend: vi.fn().mockResolvedValue(NO_ERROR),
    resetPasswordForEmail: vi.fn().mockResolvedValue(NO_ERROR),
    updateUser: vi.fn().mockResolvedValue(NO_ERROR),
    exchangeCodeForSession: vi.fn().mockResolvedValue(NO_ERROR),
    ...overrides,
  };
  return { auth, client: { auth } as unknown as SmartCityClient };
}

const signUpInput = {
  email: ' citizen@example.com ',
  password: 'long-enough',
  fullName: '  Dana Levi ',
  preferredLocale: 'ar',
} as const;

async function caught(action: () => Promise<unknown>): Promise<ApiError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the action to fail');
}

describe('signUp', () => {
  it('maps the form to the metadata names the profile trigger reads', async () => {
    const { auth, client } = fakeAuth();
    await signUp(client, signUpInput, REDIRECT);

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'citizen@example.com',
      password: 'long-enough',
      options: {
        emailRedirectTo: REDIRECT,
        data: { full_name: 'Dana Levi', preferred_locale: 'ar' },
      },
    });
  });

  it('asks for email verification when no session is returned', async () => {
    const { client } = fakeAuth();
    await expect(signUp(client, signUpInput, REDIRECT)).resolves.toEqual({
      needsEmailVerification: true,
    });
  });

  it('skips verification when the project auto-confirms', async () => {
    const { client } = fakeAuth({
      signUp: vi.fn().mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null }),
    });
    await expect(signUp(client, signUpInput, REDIRECT)).resolves.toEqual({
      needsEmailVerification: false,
    });
  });

  it('rejects invalid input without calling Supabase', async () => {
    const { auth, client } = fakeAuth();
    const error = await caught(() =>
      signUp(client, { ...signUpInput, email: 'nope', password: 'short' }, REDIRECT),
    );

    expect(error.code).toBe('validation');
    expect(authFieldErrors(error)).toEqual({
      email: 'auth.errors.invalidEmail',
      password: 'auth.errors.passwordTooShort',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe('account actions', () => {
  it('signs in with the validated credentials', async () => {
    const { auth, client } = fakeAuth();
    await signIn(client, { email: ' a@example.com', password: 'pw' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'pw',
    });
  });

  it('signs out of this device only', async () => {
    const { auth, client } = fakeAuth();
    await signOut(client);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('reports a failed sign-out', async () => {
    const { client } = fakeAuth({
      signOut: vi.fn().mockResolvedValue({ error: { name: 'AuthRetryableFetchError', status: 0 } }),
    });
    expect((await caught(() => signOut(client))).code).toBe('network');
  });

  it('sends every email link back to the given redirect URL', async () => {
    const { auth, client } = fakeAuth();
    await resendVerificationEmail(client, { email: 'a@example.com' }, REDIRECT);
    await requestPasswordReset(client, { email: 'a@example.com' }, REDIRECT);

    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@example.com',
      options: { emailRedirectTo: REDIRECT },
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@example.com', {
      redirectTo: REDIRECT,
    });
  });

  it('enforces the password rules on update', async () => {
    const { auth, client } = fakeAuth();
    await expect(updatePassword(client, { password: 'short' })).rejects.toThrow(ApiError);
    expect(auth.updateUser).not.toHaveBeenCalled();

    await updatePassword(client, { password: 'long-enough' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'long-enough' });
  });

  it('exchanges a code for a session', async () => {
    const { auth, client } = fakeAuth();
    await exchangeAuthCode(client, 'the-code');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code');
  });

  it('reports a thrown network failure as an ApiError', async () => {
    const { client } = fakeAuth({
      signInWithPassword: vi.fn().mockRejectedValue(new TypeError('Network request failed')),
    });
    const error = await caught(() => signIn(client, { email: 'a@example.com', password: 'pw' }));
    expect(error.code).toBe('network');
  });
});

describe('fromAuthError', () => {
  const cases: [string, string, string][] = [
    ['invalid_credentials', 'unauthorized', 'authErrors.invalidCredentials'],
    ['email_not_confirmed', 'forbidden', 'authErrors.emailNotConfirmed'],
    ['user_already_exists', 'conflict', 'authErrors.emailInUse'],
    ['email_exists', 'conflict', 'authErrors.emailInUse'],
    ['weak_password', 'validation', 'authErrors.weakPassword'],
    ['same_password', 'validation', 'authErrors.samePassword'],
    ['over_email_send_rate_limit', 'rate_limited', 'authErrors.emailRateLimited'],
    ['email_address_not_authorized', 'server', 'authErrors.emailSendFailed'],
    ['signup_disabled', 'forbidden', 'authErrors.signupDisabled'],
    ['reauthentication_needed', 'forbidden', 'authErrors.reauthRequired'],
    ['otp_expired', 'validation', 'authErrors.linkInvalid'],
    ['flow_state_expired', 'validation', 'authErrors.linkInvalid'],
    ['bad_code_verifier', 'validation', 'authErrors.linkInvalid'],
    ['pkce_code_verifier_not_found', 'validation', 'authErrors.linkInvalid'],
  ];

  it.each(cases)('maps %s', (code, expectedCode, expectedKey) => {
    const error = fromAuthError({ code, message: 'internal details', status: 400 });
    expect(error.code).toBe(expectedCode);
    expect(error.messageKey).toBe(expectedKey);
  });

  it('classifies unknown errors by status', () => {
    expect(fromAuthError({ status: 429, message: 'x' }).code).toBe('rate_limited');
    expect(fromAuthError({ status: 500, code: 'unexpected_failure' }).code).toBe('server');
    expect(fromAuthError({ status: 422, code: 'validation_failed' }).code).toBe('validation');
  });

  it('treats retryable fetch failures as network errors', () => {
    const error = fromAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'x' });
    expect(error.code).toBe('network');
  });

  it('never exposes the server message', () => {
    const error = fromAuthError({
      code: 'invalid_credentials',
      message: 'internal details',
      status: 400,
    });
    expect(error.message).not.toContain('internal details');
    expect(JSON.stringify(error)).not.toContain('internal details');
    expect(error.debug.message).toBe('internal details');
  });

  it('has text for its messages in every locale', () => {
    for (const [code] of cases) {
      const { messageKey } = fromAuthError({ code });
      for (const locale of SUPPORTED_LOCALES) {
        expect(translate(locale, messageKey)).not.toBe(messageKey);
      }
    }
  });
});

describe('authFieldErrors', () => {
  it('uses the server reason for a rejected password', () => {
    expect(authFieldErrors(fromAuthError({ code: 'weak_password' }))).toEqual({
      password: 'authErrors.weakPassword',
    });
  });

  it('tells a too-long password from a too-short one', async () => {
    const { client } = fakeAuth();
    const tooLong = await caught(() => updatePassword(client, { password: 'a'.repeat(73) }));
    expect(authFieldErrors(tooLong)).toEqual({ password: 'auth.errors.passwordTooLong' });

    const tooShort = await caught(() => updatePassword(client, { password: 'short' }));
    expect(authFieldErrors(tooShort)).toEqual({ password: 'auth.errors.passwordTooShort' });
  });

  it('uses the existing translations for every field, in every locale', async () => {
    const { client } = fakeAuth();
    const error = await caught(() =>
      signUp(client, { ...signUpInput, email: 'nope', password: 'short', fullName: 'x' }, REDIRECT),
    );
    const fields = Object.values(authFieldErrors(error));
    expect(fields).toHaveLength(3);
    for (const key of fields) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translate(locale, key)).not.toBe(key);
      }
    }
  });

  it('lets a form replace a field message', () => {
    const error = new ApiError('validation', {
      issues: [{ path: 'password', message: 'Too small' }],
    });
    expect(authFieldErrors(error, { password: 'auth.errors.passwordRequired' })).toEqual({
      password: 'auth.errors.passwordRequired',
    });
  });

  it('ignores errors that are not about a field', () => {
    expect(authFieldErrors(fromAuthError({ code: 'invalid_credentials' }))).toEqual({});
    expect(authFieldErrors(invalidAuthLinkError())).toEqual({});
  });
});

describe('readAuthCallback', () => {
  it('reads a code from the route params', () => {
    expect(readAuthCallback({ code: 'abc' }, null)).toEqual({ kind: 'code', code: 'abc' });
  });

  it.each([
    ['custom scheme', 'smartcity://auth/callback?code=abc'],
    ['Expo Go', 'exp://192.168.1.2:8081/--/auth/callback?code=abc'],
    ['Expo Go tunnel', 'exp://abc-anonymous-8081.exp.direct/--/auth/callback?code=abc'],
  ])('reads a code from a %s link', (_label, url) => {
    expect(readAuthCallback({}, url)).toEqual({ kind: 'code', code: 'abc' });
  });

  it.each([
    ['query', 'smartcity://auth/callback?error=access_denied&error_code=otp_expired'],
    ['fragment', 'exp://1.2.3.4:8081/--/auth/callback#error=access_denied&error_code=otp_expired'],
  ])('detects an error in the %s', (_label, url) => {
    expect(readAuthCallback({}, url)).toEqual({ kind: 'error' });
  });

  it('prefers an error over a code', () => {
    expect(readAuthCallback({ code: 'abc', error: 'access_denied' }, null).kind).toBe('error');
  });

  it('never returns tokens from a fragment, only that the email is confirmed', () => {
    const url = 'smartcity://auth/callback#access_token=secret&refresh_token=secret&type=signup';
    const result = readAuthCallback({}, url);
    expect(result).toEqual({ kind: 'email-confirmed' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('does not treat tokens from other link types as a confirmed email', () => {
    const url = 'smartcity://auth/callback#access_token=secret&type=recovery';
    expect(readAuthCallback({}, url)).toEqual({ kind: 'none' });
  });

  it('handles links with nothing useful, and malformed encoding', () => {
    expect(readAuthCallback({}, null)).toEqual({ kind: 'none' });
    expect(readAuthCallback({}, 'smartcity://auth/callback')).toEqual({ kind: 'none' });
    expect(readAuthCallback({}, 'smartcity://auth/callback?code=%E0%A4%A')).toEqual({
      kind: 'code',
      code: '%E0%A4%A',
    });
  });
});
