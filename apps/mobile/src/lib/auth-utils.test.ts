import { messages } from '@smart-city/shared/i18n';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import {
  authErrorCodeKey,
  authErrorKey,
  isPreviewAllowed,
  parseAuthCallbackUrl,
  signUpMetadata,
} from './auth-utils';

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    return typeof node === 'object' && node !== null
      ? (node as Record<string, unknown>)[part]
      : undefined;
  }, messages.en);
}

describe('isPreviewAllowed', () => {
  it('allows the dev preview only in development builds', () => {
    expect(isPreviewAllowed('development')).toBe(true);
    expect(isPreviewAllowed('production')).toBe(false);
    expect(isPreviewAllowed('test')).toBe(false);
    expect(isPreviewAllowed(undefined)).toBe(false);
    expect(isPreviewAllowed('')).toBe(false);
    expect(isPreviewAllowed('Development')).toBe(false);
  });
});

describe('signUpMetadata', () => {
  it('uses the exact keys the handle_new_user trigger reads', () => {
    expect(
      signUpMetadata({
        fullName: '  Dana Levi ',
        preferredLocale: 'ar',
        homeMunicipalityId: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
      }),
    ).toEqual({
      full_name: 'Dana Levi',
      preferred_locale: 'ar',
      home_municipality_id: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
    });
  });
});

describe('parseAuthCallbackUrl', () => {
  it('reads the PKCE code from a custom-scheme link', () => {
    expect(parseAuthCallbackUrl('smartcity://auth/callback?code=abc-123')).toEqual({
      code: 'abc-123',
    });
  });

  it('reads the code from an Expo Go link', () => {
    expect(parseAuthCallbackUrl('exp://192.168.1.5:8081/--/auth/callback?code=xyz')).toMatchObject({
      code: 'xyz',
    });
  });

  it('reads errors from the fragment and decodes them', () => {
    expect(
      parseAuthCallbackUrl(
        'smartcity://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({
      error: 'access_denied',
      errorCode: 'otp_expired',
      errorDescription: 'Email link is invalid or has expired',
    });
  });

  it('reads errors from the query string', () => {
    expect(
      parseAuthCallbackUrl(
        'smartcity://auth/callback?error=server_error&error_code=flow_state_expired',
      ),
    ).toMatchObject({ error: 'server_error', errorCode: 'flow_state_expired' });
  });

  it('returns nothing for a link without parameters', () => {
    expect(parseAuthCallbackUrl('smartcity://auth/callback')).toEqual({});
  });

  it('tolerates malformed encoding', () => {
    expect(parseAuthCallbackUrl('smartcity://auth/callback?code=%E0%A4%A')).toEqual({
      code: '%E0%A4%A',
    });
  });
});

describe('authErrorKey', () => {
  it('maps known Supabase codes', () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(authErrorKey(error)).toBe('auth.errors.invalidCredentials');
    expect(authErrorCodeKey('email_not_confirmed')).toBe('auth.errors.emailNotConfirmed');
    expect(authErrorCodeKey('otp_expired')).toBe('auth.errors.linkExpired');
    expect(authErrorCodeKey('flow_state_not_found')).toBe('auth.errors.linkInvalid');
    expect(authErrorCodeKey('same_password')).toBe('auth.errors.samePassword');
    expect(authErrorCodeKey('over_email_send_rate_limit')).toBe('auth.errors.rateLimited');
  });

  it('maps network failures and unknown errors', () => {
    expect(authErrorKey(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(
      'auth.errors.network',
    );
    expect(authErrorKey(new Error('boom'))).toBe('auth.errors.unknown');
    expect(authErrorCodeKey('something_new')).toBe('auth.errors.unknown');
  });

  it('only returns keys that exist in the translations', () => {
    const codes = [
      'invalid_credentials',
      'email_not_confirmed',
      'user_already_exists',
      'weak_password',
      'same_password',
      'email_address_invalid',
      'over_request_rate_limit',
      'otp_expired',
      'bad_code_verifier',
      'session_not_found',
      undefined,
    ];
    for (const code of codes) {
      expect(typeof lookup(authErrorCodeKey(code))).toBe('string');
    }
  });
});
