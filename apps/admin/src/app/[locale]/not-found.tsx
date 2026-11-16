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
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <div aria-hidden className="absolute inset-0 -z-10 grid-dots opacity-70" />
      <div className="w-full max-w-md animate-enter text-center">
        <p className="bg-gradient-to-b from-foreground to-subtle bg-clip-text font-mono text-8xl leading-none font-semibold tracking-tighter text-transparent tabular-nums">
          404
        </p>
        <span className="mx-auto mt-6 flex size-12 items-center justify-center rounded-2xl bg-surface text-accent shadow-[0_0_0_1px_var(--border),0_10px_30px_-10px_var(--focus-ring)]">
          <Icon name="search" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
          {t('adminNotFound.title')}
        </h1>
        <p className="mt-2 text-md text-muted">{t('adminNotFound.description')}</p>
        <ButtonLink
          href={localizedHref(locale, '/')}
          variant="primary"
          size="lg"
          className="mt-7"
          icon="overview"
        >
          {t('adminNotFound.backToOverview')}
        </ButtonLink>
      </div>
    </main>
  );
}
