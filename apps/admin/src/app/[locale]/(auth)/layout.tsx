import { SUPPORTED_LOCALES } from '@smart-city/shared';

import { BrandMark } from '@/components/shell/brand-mark';
import { LanguageSwitcher } from '@/components/shell/language-switcher';
import { Icon } from '@/components/ui/icon';
import { getLocale, getTranslator } from '@/lib/i18n/server';

import packageJson from '../../../../package.json';

/**
 * Sign-in, password reset and staff access. Static chrome only: nothing here reads the
 * session, so it is prerendered per language; each page reads what it needs inside its own
 * Suspense boundary.
 */
export default async function AuthLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();
  const t = await getTranslator();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-e border-border bg-sidebar p-10 lg:flex xl:p-12">
        {/* A quiet street grid that hints at a city map, drawn with CSS only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_75%)] [background-size:44px_44px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-40 -top-40 size-[32rem] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <BrandMark size="lg" />
          <div className="leading-tight">
            <p className="text-md font-semibold text-foreground">{t('app.name')}</p>
            <p className="text-sm text-muted">{t('adminShell.productTagline')}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="mb-5 flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-accent shadow-sm">
            <Icon name="roles" className="size-5" />
          </span>
          <p className="text-2xl leading-snug font-semibold tracking-tight text-foreground xl:text-3xl">
            {t('adminAuth.signInSubtitle')}
          </p>
          <p className="mt-3 text-base text-muted">{t('adminAuth.staffOnlyNote')}</p>
        </div>

        <p className="relative text-xs text-subtle tabular-nums">
          {t('adminShell.version', { version: packageJson.version })}
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-background">
        <header className="flex h-(--header-height) items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2.5 lg:invisible">
            <BrandMark />
            <span className="font-semibold text-foreground">{t('app.name')}</span>
          </div>
          <LanguageSwitcher
            current={locale}
            label={t('adminShell.changeLanguage')}
            options={SUPPORTED_LOCALES.map((option) => ({
              locale: option,
              label: t(`language.${option}`),
            }))}
          />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 py-8 md:items-center md:px-8">
          <div className="w-full max-w-[420px] animate-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
