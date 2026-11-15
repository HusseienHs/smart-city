import { SUPPORTED_LOCALES } from '@smart-city/shared';

import { BrandMark } from '@/components/shell/brand-mark';
import { LanguageSwitcher } from '@/components/shell/language-switcher';
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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-navy-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-md leading-5 font-semibold text-white">{t('app.name')}</p>
            <p className="text-xs text-navy-muted">{t('adminShell.productTagline')}</p>
          </div>
        </div>
        <div className="max-w-sm">
          <p className="text-2xl leading-snug font-semibold text-white">
            {t('adminAuth.signInSubtitle')}
          </p>
          <p className="mt-3 text-base text-navy-muted">{t('adminAuth.staffOnlyNote')}</p>
        </div>
        <p className="text-xs text-navy-muted">
          {t('adminShell.version', { version: packageJson.version })}
        </p>
        {/* A quiet grid that hints at a city map, drawn with CSS only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--navy-foreground)_1px,transparent_1px),linear-gradient(90deg,var(--navy-foreground)_1px,transparent_1px)] [background-size:48px_48px] opacity-[0.07]"
        />
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
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
