import { getTextDirection, resolveLocale, type Locale } from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { useLocales } from 'expo-localization';
import { createContext, use, useEffect, useMemo, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

interface I18nContextValue {
  locale: Locale;
  direction: 'rtl' | 'ltr';
  t: Translator;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Provides the active locale, derived from the device language preferences.
 * Phase 2 adds an in-app language picker persisted to the user profile.
 */
export function I18nProvider({ children }: PropsWithChildren) {
  const deviceLocales = useLocales();
  const locale = resolveLocale(deviceLocales.map((entry) => entry.languageTag));

  const value = useMemo<I18nContextValue>(
    () => ({ locale, direction: getTextDirection(locale), t: createTranslator(locale) }),
    [locale],
  );

  // Native apps mirror layouts through I18nManager. On the web, the document direction does
  // it: flex rows, tab bars and horizontal lists follow `dir`.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = value.direction;
  }, [locale, value.direction]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
