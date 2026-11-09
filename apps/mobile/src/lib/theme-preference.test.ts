import { describe, expect, it } from 'vitest';

import type { KeyValueStore } from './password-recovery-state';
import { loadThemePreference, saveThemePreference, THEME_STORAGE_KEY } from './theme-preference';

function diskStore(disk = new Map<string, string>()): KeyValueStore {
  return {
    getItem: async (key) => disk.get(key) ?? null,
    setItem: async (key, value) => void disk.set(key, value),
    removeItem: async (key) => void disk.delete(key),
  };
}

const brokenStore: KeyValueStore = {
  getItem: () => Promise.reject(new Error('unavailable')),
  setItem: () => Promise.reject(new Error('unavailable')),
  removeItem: () => Promise.reject(new Error('unavailable')),
};

describe('theme preference', () => {
  it('defaults to light', async () => {
    expect(await loadThemePreference(diskStore())).toBe('light');
  });

  it('survives an app restart', async () => {
    const disk = new Map<string, string>();
    await saveThemePreference(diskStore(disk), 'dark');
    expect(await loadThemePreference(diskStore(disk))).toBe('dark');
  });

  it('falls back to light on corrupt values or broken storage', async () => {
    expect(await loadThemePreference(diskStore(new Map([[THEME_STORAGE_KEY, 'blue']])))).toBe(
      'light',
    );
    expect(await loadThemePreference(brokenStore)).toBe('light');
    await expect(saveThemePreference(brokenStore, 'dark')).resolves.toBeUndefined();
  });
});
