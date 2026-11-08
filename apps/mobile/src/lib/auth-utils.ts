/**
 * Pure authentication helpers (no React Native imports) so they can be unit-tested in Node.
 */
import type { Locale } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Whether the development-only preview entry may be offered. Only the development build
 * qualifies: Expo inlines NODE_ENV at build time ("production" in release builds), so the
 * preview path is compiled out of production. Preview never creates a Supabase session.
 */
export function isPreviewAllowed(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}

/** Route of the screen that receives email links (confirmation and password recovery). */
export const AUTH_CALLBACK_PATH = 'auth/callback';

/**
 * Sign-up metadata. `private.handle_new_user` copies exactly these keys into
 * `public.profiles.full_name` and `public.profiles.preferred_locale`.
 */
export function signUpMetadata(input: {
  fullName: string;
  preferredLocale: Locale;
  homeMunicipalityId: string;
}) {
  return {
    full_name: input.fullName.trim(),
    preferred_locale: input.preferredLocale,
    home_municipality_id: input.homeMunicipalityId,
  };
}

/** Maps a Supabase Auth error code to a translated message. Unknown codes get a generic one. */
export function authErrorCodeKey(code: string | undefined): MessageKey {
  switch (code) {
    case 'invalid_credentials':
      return 'auth.errors.invalidCredentials';
    case 'email_not_confirmed':
      return 'auth.errors.emailNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'auth.errors.userExists';
    case 'weak_password':
      return 'auth.errors.weakPassword';
    case 'same_password':
      return 'auth.errors.samePassword';
    case 'email_address_invalid':
      return 'auth.errors.invalidEmail';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'auth.errors.rateLimited';
    case 'otp_expired':
      return 'auth.errors.linkExpired';
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier':
    case 'bad_oauth_state':
    case 'otp_disabled':
      return 'auth.errors.linkInvalid';
    case 'session_not_found':
    case 'refresh_token_not_found':
      return 'auth.errors.sessionExpired';
    default:
      return 'auth.errors.unknown';
  }
}

/** Maps anything thrown or returned by Supabase Auth to a translated message. */
export function authErrorKey(error: unknown): MessageKey {
  if (isAuthRetryableFetchError(error)) return 'auth.errors.network';
  if (!isAuthError(error)) return 'auth.errors.unknown';
  return authErrorCodeKey(error.code);
}

export interface AuthCallbackParams {
  /** PKCE authorization code, exchanged for a session. */
  code?: string;
  /** Present when Supabase rejected the link (expired, already used, …). */
  error?: string;
  errorCode?: string;
  errorDescription?: string;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parsePairs(text: string, into: Record<string, string>) {
  for (const pair of text.split('&')) {
    if (!pair) continue;
    const [rawKey = '', ...rest] = pair.split('=');
    into[decode(rawKey)] = decode(rest.join('='));
  }
}

/**
 * Reads the parameters Supabase appends to an email link. With PKCE the code arrives in the
 * query string; errors can arrive in the query string or the `#fragment`, so both are read.
 * (Hand-rolled because React Native's URL implementation is incomplete.)
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex !== -1) parsePairs(beforeHash.slice(queryIndex + 1), params);
  if (hashIndex !== -1) parsePairs(url.slice(hashIndex + 1), params);

  return {
    code: params.code || undefined,
    error: params.error || undefined,
    errorCode: params.error_code || undefined,
    errorDescription: params.error_description || undefined,
  };
}
