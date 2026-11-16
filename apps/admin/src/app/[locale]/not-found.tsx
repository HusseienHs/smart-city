import { DEFAULT_LOCALE, isSupportedLocale } from '@smart-city/shared';
import { createTranslator } from '@smart-city/shared/i18n';
import { locale as localeParam } from 'next/root-params';

import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { localizedHref } from '@/lib/i18n/routing';

export default async function NotFound() {
  const value = await localeParam();
  const locale = isSupportedLocale(value) ? value : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md animate-enter card p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-surface text-muted shadow-sm">
          <Icon name="search" />
        </span>
        <p className="text-xs font-semibold tracking-wider text-muted tabular-nums">404</p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">{t('adminNotFound.title')}</h1>
        <p className="mt-2 text-base text-muted">{t('adminNotFound.description')}</p>
        <ButtonLink href={localizedHref(locale, '/')} variant="primary" className="mt-6">
          {t('adminNotFound.backToOverview')}
        </ButtonLink>
      </div>
    </main>
  );
}
