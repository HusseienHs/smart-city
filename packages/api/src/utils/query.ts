import { fromSupabaseError, toApiError, type SupabaseErrorLike } from '../errors/to-api-error';

interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
  status?: number;
}

/**
 * Awaits a Supabase list query and returns its rows, or throws an ApiError.
 * Row Level Security hiding every row is not an error: it's an empty list.
 */
export async function runListQuery<T>(query: PromiseLike<SupabaseResponse<T[]>>): Promise<T[]> {
  let response: SupabaseResponse<T[]>;
  try {
    response = await query;
  } catch (error) {
    throw toApiError(error);
  }
  if (response.error) throw fromSupabaseError(response.error, response.status);
  return response.data ?? [];
}
