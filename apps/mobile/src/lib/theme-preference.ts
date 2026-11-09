/**
 * The user's light/dark choice, persisted on the device. The app is light unless the user
 * turns dark mode on in the profile; the phone's system setting is not followed. Pure
 * (storage passed in) so it can be unit-tested; the app passes AsyncStorage.
 */
import type { ColorSchemeName } from '@smart-city/shared';

import type { KeyValueStore } from './password-recovery-state';

export const THEME_STORAGE_KEY = 'smart-city.theme';
export const DEFAULT_COLOR_SCHEME: ColorSchemeName = 'light';

function isColorScheme(value: unknown): value is ColorSchemeName {
  return value === 'light' || value === 'dark';
}

/** The stored choice, or the default (light) when none was made or storage fails. */
export async function loadThemePreference(store: KeyValueStore): Promise<ColorSchemeName> {
  try {
    const value = await store.getItem(THEME_STORAGE_KEY);
    return isColorScheme(value) ? value : DEFAULT_COLOR_SCHEME;
  } catch {
    return DEFAULT_COLOR_SCHEME;
  }
}

export async function saveThemePreference(
  store: KeyValueStore,
  scheme: ColorSchemeName,
): Promise<void> {
  try {
    await store.setItem(THEME_STORAGE_KEY, scheme);
  } catch {
    // The choice still applies for this session.
  }
}
