import { isSupportedLocale, type Locale } from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { notFound } from 'next/navigation';
import { locale as localeParam } from 'next/root-params';

/**
 * The locale of the current request, read from the `[locale]` root segment. Usable from any
 * Server Component without prop drilling. Unknown locales render the 404 page.
 */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isSupportedLocale(value)) notFound();
  return value;
}

/** A translator for the current request's locale. */
export async function getTranslator(): Promise<Translator> {
  return createTranslator(await getLocale());
}
