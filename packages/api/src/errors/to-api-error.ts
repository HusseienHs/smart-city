import { ApiError, type ApiErrorCode, type ApiErrorDebugInfo } from './api-error';

/** The fields shared by PostgrestError and similar Supabase errors. */
export interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/** Postgres / PostgREST codes we can classify. Our RPCs raise 42501, 22023 and P0001. */
const CODES: Readonly<Record<string, ApiErrorCode>> = {
  '42501': 'forbidden', // insufficient privilege; our uniform "not found or access denied"
  '22023': 'validation', // invalid parameter value (raised by our RPCs)
  '22P02': 'validation', // invalid text representation (e.g. a malformed uuid)
  '22001': 'validation', // value too long
  '23502': 'validation', // not-null violation
  '23503': 'validation', // foreign-key violation
  '23514': 'validation', // check violation
  '23505': 'conflict', // unique violation
  PGRST116: 'not_found', // .single() matched no rows
  PGRST301: 'unauthorized', // invalid or expired JWT
  PGRST302: 'unauthorized', // anonymous access not allowed
  PGRST303: 'unauthorized', // JWT claims rejected
};

function classify(error: SupabaseErrorLike, status: number | undefined): ApiErrorCode {
  // supabase-js reports failed fetches as a resolved response with status 0 and no code.
  if (status === 0) return 'network';
  if (error.code === 'P0001' && error.hint === 'rate_limited') return 'rate_limited';
  if (error.code === '42501' && status === 401) return 'unauthorized';

  const known = error.code ? CODES[error.code] : undefined;
  if (known) return known;

  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  return 'server';
}

/** Converts a Supabase error response into an ApiError, keeping internals in `debug` only. */
export function fromSupabaseError(error: SupabaseErrorLike, status?: number): ApiError {
  const debug: ApiErrorDebugInfo = {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    status,
  };
  return new ApiError(classify(error, status), { debug });
}

/** Converts anything thrown while talking to the backend into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  // fetch() rejects with a TypeError when the network is unavailable.
  if (error instanceof TypeError) {
    return new ApiError('network', { debug: { message: error.message } });
  }
  if (error instanceof Error) {
    return new ApiError('server', { debug: { message: error.message } });
  }
  return new ApiError('server', { debug: { message: String(error) } });
}
