import type { MessageKey } from '@smart-city/shared/i18n';

export type ApiErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'network'
  | 'server';

/** One invalid input field. Only produced from our own Zod validation. */
export interface ApiValidationIssue {
  path: string;
  message: string;
}

/** Original failure details, for logs and development tools only. Never show them to users. */
export interface ApiErrorDebugInfo {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

const MESSAGE_KEYS: Readonly<Record<ApiErrorCode, MessageKey>> = {
  validation: 'apiErrors.validation',
  unauthorized: 'apiErrors.unauthorized',
  forbidden: 'apiErrors.forbidden',
  not_found: 'apiErrors.notFound',
  conflict: 'apiErrors.conflict',
  rate_limited: 'apiErrors.rateLimited',
  network: 'apiErrors.network',
  server: 'apiErrors.server',
};

const SAFE_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  validation: 'The request contains invalid data',
  unauthorized: 'Sign-in is required',
  forbidden: 'Not found or access denied',
  not_found: 'Not found',
  conflict: 'This conflicts with existing data',
  rate_limited: 'Too many requests',
  network: 'The network request failed',
  server: 'The request could not be completed',
};

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set(['network', 'server', 'rate_limited']);

/**
 * The only error type API functions throw.
 *
 * `message` is always a fixed, safe string, and `messageKey` gives the localized text for the UI.
 * Database internals live in `debug`, which is non-enumerable: it can be logged deliberately,
 * but it isn't included by JSON.stringify, so it can't leak through a serialized response.
 * (Postgres puts literal SQL in `hint` for permission errors, for example.)
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly messageKey: MessageKey;
  readonly issues: readonly ApiValidationIssue[];
  readonly debug!: ApiErrorDebugInfo;

  constructor(
    code: ApiErrorCode,
    options: {
      debug?: ApiErrorDebugInfo;
      issues?: readonly ApiValidationIssue[];
      /** A more specific message than the default for this code. */
      messageKey?: MessageKey;
    } = {},
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = 'ApiError';
    this.code = code;
    this.messageKey = options.messageKey ?? MESSAGE_KEYS[code];
    this.issues = options.issues ?? [];
    Object.defineProperty(this, 'debug', {
      value: options.debug ?? {},
      enumerable: false,
      writable: false,
    });
  }

  /** Whether trying the same request again might succeed. */
  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
