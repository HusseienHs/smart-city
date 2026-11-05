import { describe, expect, it } from 'vitest';

import {
  clearPasswordRecovery,
  isPasswordRecoveryPending,
  markPasswordRecovery,
  PASSWORD_RECOVERY_STORAGE_KEY,
  restoreAuthState,
  type KeyValueStore,
} from './password-recovery-state';

/** Survives "restarts": a new reader of the same map is a relaunched app with the same disk. */
function diskStore(disk = new Map<string, string>()): KeyValueStore {
  return {
    getItem: async (key) => disk.get(key) ?? null,
    setItem: async (key, value) => void disk.set(key, value),
    removeItem: async (key) => void disk.delete(key),
  };
}

const brokenStore: KeyValueStore = {
  getItem: () => Promise.reject(new Error('storage unavailable')),
  setItem: () => Promise.reject(new Error('storage unavailable')),
  removeItem: () => Promise.reject(new Error('storage unavailable')),
};

describe('password recovery state', () => {
  it('is still pending after an app restart, for the same user', async () => {
    const disk = new Map<string, string>();
    await markPasswordRecovery(diskStore(disk), 'user-1');

    const relaunched = diskStore(disk);
    expect(await isPasswordRecoveryPending(relaunched, 'user-1')).toBe(true);
  });

  it('is cleared once the new password is saved or the user signs out', async () => {
    const disk = new Map<string, string>();
    await markPasswordRecovery(diskStore(disk), 'user-1');
    await clearPasswordRecovery(diskStore(disk));

    expect(await isPasswordRecoveryPending(diskStore(disk), 'user-1')).toBe(false);
    expect(disk.has(PASSWORD_RECOVERY_STORAGE_KEY)).toBe(false);
  });

  it('never applies to a different user, and removes the stale marker', async () => {
    const disk = new Map<string, string>();
    await markPasswordRecovery(diskStore(disk), 'user-1');

    expect(await isPasswordRecoveryPending(diskStore(disk), 'user-2')).toBe(false);
    expect(disk.has(PASSWORD_RECOVERY_STORAGE_KEY)).toBe(false);
  });

  it('is not pending without a session', async () => {
    const disk = new Map([[PASSWORD_RECOVERY_STORAGE_KEY, 'user-1']]);
    expect(await isPasswordRecoveryPending(diskStore(disk), undefined)).toBe(false);
  });

  it('stores only the user id', async () => {
    const disk = new Map<string, string>();
    await markPasswordRecovery(diskStore(disk), 'user-1');
    expect([...disk.entries()]).toEqual([[PASSWORD_RECOVERY_STORAGE_KEY, 'user-1']]);
  });

  it('restores the session and the pending reset together on startup', async () => {
    const disk = new Map<string, string>();
    await markPasswordRecovery(diskStore(disk), 'user-1');
    const session = { user: { id: 'user-1' } };

    const restored = await restoreAuthState(async () => ({ data: { session } }), diskStore(disk));
    expect(restored).toEqual({ session, isRecoveringPassword: true });
  });

  it('restores a normal session without a pending reset', async () => {
    const session = { user: { id: 'user-1' } };
    const restored = await restoreAuthState(async () => ({ data: { session } }), diskStore());
    expect(restored).toEqual({ session, isRecoveringPassword: false });
  });

  it('restores a signed-out state and drops a leftover marker', async () => {
    const disk = new Map([[PASSWORD_RECOVERY_STORAGE_KEY, 'user-1']]);
    const restored = await restoreAuthState(
      async () => ({ data: { session: null } }),
      diskStore(disk),
    );
    expect(restored).toEqual({ session: null, isRecoveringPassword: false });
  });

  it('does not throw when storage is unavailable', async () => {
    await expect(markPasswordRecovery(brokenStore, 'user-1')).resolves.toBeUndefined();
    await expect(clearPasswordRecovery(brokenStore)).resolves.toBeUndefined();
    expect(await isPasswordRecoveryPending(brokenStore, 'user-1')).toBe(false);
  });
});
