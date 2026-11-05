import type { SmartCityClient } from '../client';
import { ApiError } from '../errors/api-error';
import { toApiError } from '../errors/to-api-error';

/**
 * The signed-in user's id, from the client's session. Throws ApiError('unauthorized') without one.
 *
 * Authorization never depends on this value: Row Level Security checks the verified JWT. The id
 * is only used as an explicit filter (defense in depth) and to fill `user_id` on inserts, which
 * RLS rejects unless it is the caller's own id.
 */
export async function requireUserId(client: SmartCityClient): Promise<string> {
  let result: Awaited<ReturnType<SmartCityClient['auth']['getSession']>>;
  try {
    result = await client.auth.getSession();
  } catch (error) {
    throw toApiError(error);
  }
  const userId = result.data.session?.user.id;
  if (result.error || !userId) {
    throw new ApiError('unauthorized', { debug: { message: result.error?.message } });
  }
  return userId;
}
