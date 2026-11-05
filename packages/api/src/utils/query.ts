import { fromSupabaseError, toApiError, type SupabaseErrorLike } from '../errors/to-api-error';

interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
  status?: number;
}

async function settle<T>(query: PromiseLike<SupabaseResponse<T>>): Promise<T | null> {
  let response: SupabaseResponse<T>;
  try {
    response = await query;
  } catch (error) {
    throw toApiError(error);
  }
  if (response.error) throw fromSupabaseError(response.error, response.status);
  return response.data;
}

/**
 * Awaits a Supabase list query and returns its rows, or throws an ApiError.
 * Row Level Security hiding every row is not an error: it's an empty list.
 */
export async function runListQuery<T>(query: PromiseLike<SupabaseResponse<T[]>>): Promise<T[]> {
  return (await settle(query)) ?? [];
}

/**
 * Awaits a `.maybeSingle()` query: the row, or null when nothing matches (or RLS hides it).
 * Throws an ApiError on failure.
 */
export async function runMaybeSingleQuery<T>(
  query: PromiseLike<SupabaseResponse<T>>,
): Promise<T | null> {
  return settle(query);
}

/** Awaits a write without a returned body (e.g. a delete). Throws an ApiError on failure. */
export async function runMutation(query: PromiseLike<SupabaseResponse<unknown>>): Promise<void> {
  await settle(query);
}
