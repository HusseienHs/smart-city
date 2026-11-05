import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTextDirection, type Locale } from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { useLocales } from 'expo-localization';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';

import { loadLocalePreference, resolveAppLocale, saveLocalePreference } from './locale-preference';

interface I18nContextValue {
  locale: Locale;
  direction: 'rtl' | 'ltr';
  t: Translator;
  /** Switches the whole app immediately and remembers the choice on this device. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Provides the active locale: the user's saved choice, otherwise the device languages.
 * Children render only once the saved choice is loaded (the splash screen stays up), so the
 * app never flashes in the wrong language or direction.
 *
 * When signed in, the language screen also saves the choice to `profiles.preferred_locale`.
 */
export function I18nProvider({ children }: PropsWithChildren) {
  const deviceLocales = useLocales();
  const [preference, setPreference] = useState<Locale | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void loadLocalePreference(AsyncStorage).then((saved) => {
      setPreference(saved);
      setIsReady(true);
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setPreference(next);
    void saveLocalePreference(AsyncStorage, next);
  }, []);

  const locale = resolveAppLocale(
    preference,
    deviceLocales.map((entry) => entry.languageTag),
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, direction: getTextDirection(locale), t: createTranslator(locale), setLocale }),
    [locale, setLocale],
  );

  // Native layouts follow the root `direction` style and the navigation LocaleProvider (root
  // layout). On the web, the document direction does it: flex rows, tab bars and lists follow
  // `dir`.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = value.direction;
  }, [locale, value.direction]);

  if (!isReady) return null;
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
