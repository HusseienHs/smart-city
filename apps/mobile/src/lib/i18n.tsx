import { getTextDirection, resolveLocale, type Locale } from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { useLocales } from 'expo-localization';
import { createContext, use, useMemo, type PropsWithChildren } from 'react';

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

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
