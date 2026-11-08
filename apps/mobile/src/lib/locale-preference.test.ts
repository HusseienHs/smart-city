import { describe, expect, it } from 'vitest';

import {
  loadLocalePreference,
  LOCALE_STORAGE_KEY,
  resolveAppLocale,
  saveLocalePreference,
} from './locale-preference';
import type { KeyValueStore } from './password-recovery-state';

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

describe('locale preference', () => {
  it('survives an app restart', async () => {
    const disk = new Map<string, string>();
    await saveLocalePreference(diskStore(disk), 'ar');
    expect(await loadLocalePreference(diskStore(disk))).toBe('ar');
  });

  it('ignores missing, unsupported or corrupt values', async () => {
    expect(await loadLocalePreference(diskStore())).toBeNull();
    expect(await loadLocalePreference(diskStore(new Map([[LOCALE_STORAGE_KEY, 'fr']])))).toBeNull();
    expect(await loadLocalePreference(brokenStore)).toBeNull();
    await expect(saveLocalePreference(brokenStore, 'en')).resolves.toBeUndefined();
  });

  it('prefers the explicit choice over the device language', () => {
    expect(resolveAppLocale('en', ['he-IL'])).toBe('en');
    expect(resolveAppLocale(null, ['ar-IL', 'en-US'])).toBe('ar');
    expect(resolveAppLocale(null, ['fr-FR'])).toBe('he');
  });
});
