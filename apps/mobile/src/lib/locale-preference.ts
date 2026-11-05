/**
 * The user's in-app language choice, persisted on the device. Pure (storage passed in) so it
 * can be unit-tested; the app passes AsyncStorage.
 */
import { isSupportedLocale, resolveLocale, type Locale } from '@smart-city/shared';

import type { KeyValueStore } from './password-recovery-state';

export const LOCALE_STORAGE_KEY = 'smart-city.locale';

/** The stored choice, or null when none was made (or storage is unavailable/corrupt). */
export async function loadLocalePreference(store: KeyValueStore): Promise<Locale | null> {
  try {
    const value = await store.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export async function saveLocalePreference(store: KeyValueStore, locale: Locale): Promise<void> {
  try {
    await store.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The choice still applies for this session.
  }
}

/** Priority: the user's explicit choice, then the device languages, then Hebrew. */
export function resolveAppLocale(
  preference: Locale | null,
  deviceLanguageTags: readonly (string | null | undefined)[],
): Locale {
  return preference ?? resolveLocale(deviceLanguageTags);
}
