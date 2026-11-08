/**
 * Remembers that a user signed in through a password-recovery link and still has to choose a
 * new password, so closing the app on the reset screen can't skip that step.
 * Pure (storage is passed in) so it can be unit-tested; the app passes AsyncStorage.
 */

/** The subset of AsyncStorage used here. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const PASSWORD_RECOVERY_STORAGE_KEY = 'smart-city.auth.password-recovery';

/** Records the pending reset for this user (the value is the user id, never a token). */
export async function markPasswordRecovery(store: KeyValueStore, userId: string): Promise<void> {
  try {
    await store.setItem(PASSWORD_RECOVERY_STORAGE_KEY, userId);
  } catch {
    // Storage unavailable: the in-memory state still protects the current app session.
  }
}

export async function clearPasswordRecovery(store: KeyValueStore): Promise<void> {
  try {
    await store.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/**
 * Whether the restored session still owes a new password. Only true for the same user that
 * opened the recovery link; a stale marker for anyone else is removed.
 */
export async function isPasswordRecoveryPending(
  store: KeyValueStore,
  userId: string | undefined,
): Promise<boolean> {
  let pendingFor: string | null;
  try {
    pendingFor = await store.getItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    return false;
  }
  if (pendingFor === null) return false;
  if (userId && pendingFor === userId) return true;
  await clearPasswordRecovery(store);
  return false;
}

/**
 * Startup restore: the stored session together with whether it still owes a new password.
 * Both are resolved before the caller ends its loading state, so the first routing decision
 * already knows about a pending reset.
 */
export async function restoreAuthState<TSession extends { user: { id: string } }>(
  getSession: () => Promise<{ data: { session: TSession | null } }>,
  store: KeyValueStore,
): Promise<{ session: TSession | null; isRecoveringPassword: boolean }> {
  const { data } = await getSession();
  const isRecoveringPassword = await isPasswordRecoveryPending(store, data.session?.user.id);
  return { session: data.session, isRecoveringPassword };
}
