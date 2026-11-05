import { PASSWORD_TOO_LONG_MESSAGE } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';

import { ApiError, type ApiErrorCode } from '../errors/api-error';
import { fromSupabaseError } from '../errors/to-api-error';

/** The fields shared by AuthError and its subclasses. Read by shape, not with instanceof. */
export interface SupabaseAuthErrorLike {
  name?: string;
  code?: string;
  message?: string;
  status?: number;
}

interface KnownAuthError {
  code: ApiErrorCode;
  messageKey?: MessageKey;
  /** The form field this error belongs to, when there is one. */
  field?: 'email' | 'password';
}

const LINK_INVALID: KnownAuthError = { code: 'validation', messageKey: 'authErrors.linkInvalid' };
const EMAIL_IN_USE: KnownAuthError = { code: 'conflict', messageKey: 'authErrors.emailInUse' };
const SIGNUP_DISABLED: KnownAuthError = {
  code: 'forbidden',
  messageKey: 'authErrors.signupDisabled',
};
const REAUTH_REQUIRED: KnownAuthError = {
  code: 'forbidden',
  messageKey: 'authErrors.reauthRequired',
};

/** Supabase Auth error codes the citizen flows can hit. Anything else is classified by status. */
const KNOWN_ERRORS: Readonly<Record<string, KnownAuthError>> = {
  invalid_credentials: { code: 'unauthorized', messageKey: 'authErrors.invalidCredentials' },
  email_not_confirmed: { code: 'forbidden', messageKey: 'authErrors.emailNotConfirmed' },
  user_already_exists: EMAIL_IN_USE,
  email_exists: EMAIL_IN_USE,
  email_address_invalid: { code: 'validation', field: 'email' },
  weak_password: { code: 'validation', messageKey: 'authErrors.weakPassword', field: 'password' },
  same_password: { code: 'validation', messageKey: 'authErrors.samePassword', field: 'password' },
  over_email_send_rate_limit: { code: 'rate_limited', messageKey: 'authErrors.emailRateLimited' },
  email_address_not_authorized: { code: 'server', messageKey: 'authErrors.emailSendFailed' },
  signup_disabled: SIGNUP_DISABLED,
  email_provider_disabled: SIGNUP_DISABLED,
  reauthentication_needed: REAUTH_REQUIRED,
  reauthentication_not_valid: REAUTH_REQUIRED,
  otp_expired: LINK_INVALID,
  flow_state_expired: LINK_INVALID,
  flow_state_not_found: LINK_INVALID,
  bad_code_verifier: LINK_INVALID,
  pkce_code_verifier_not_found: LINK_INVALID,
};

/** Converts a Supabase Auth error into an ApiError with a message the UI can show. */
export function fromAuthError(error: SupabaseAuthErrorLike): ApiError {
  const debug = { code: error.code, message: error.message, status: error.status };

  // Covers failed fetches and gateway errors, with or without a status.
  if (error.name === 'AuthRetryableFetchError') return new ApiError('network', { debug });

  const known = error.code ? KNOWN_ERRORS[error.code] : undefined;
  if (known) {
    return new ApiError(known.code, {
      debug,
      messageKey: known.messageKey,
      issues: known.field ? [{ path: known.field, message: 'Rejected by the server' }] : undefined,
    });
  }

  if (error.status === 422 || error.code === 'validation_failed') {
    return new ApiError('validation', { debug });
  }
  return fromSupabaseError({ code: error.code, message: error.message }, error.status);
}

/** The error to show when a callback link can't be used, such as one with no code. */
export function invalidAuthLinkError(): ApiError {
  return new ApiError(LINK_INVALID.code, { messageKey: LINK_INVALID.messageKey });
}

export type AuthFormField = 'email' | 'password' | 'fullName';
export type AuthFieldErrors = Partial<Record<AuthFormField, MessageKey>>;

const FIELD_MESSAGES: Readonly<Record<AuthFormField, MessageKey>> = {
  email: 'auth.errors.invalidEmail',
  password: 'auth.errors.passwordTooShort',
  fullName: 'auth.errors.nameRequired',
};

function isAuthFormField(path: string): path is AuthFormField {
  return path in FIELD_MESSAGES;
}

function fieldMessage(field: AuthFormField, issueMessage: string): MessageKey {
  return issueMessage === PASSWORD_TOO_LONG_MESSAGE
    ? 'auth.errors.passwordTooLong'
    : FIELD_MESSAGES[field];
}

/**
 * Localized per-field messages for a validation error. Zod's own messages are English-only, so
 * the field decides the text, unless the server gave a specific reason (e.g. a weak password).
 * A sign-in form should pass `{ password: 'auth.errors.passwordRequired' }` as an override.
 */
export function authFieldErrors(error: ApiError, overrides: AuthFieldErrors = {}): AuthFieldErrors {
  if (error.code !== 'validation') return {};

  const specific = error.messageKey === 'apiErrors.validation' ? undefined : error.messageKey;
  const result: AuthFieldErrors = {};
  for (const { path, message } of error.issues) {
    if (isAuthFormField(path)) {
      result[path] ??= specific ?? overrides[path] ?? fieldMessage(path, message);
    }
  }
  return result;
}
