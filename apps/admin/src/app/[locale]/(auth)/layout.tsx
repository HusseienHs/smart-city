import { SUPPORTED_LOCALES } from '@smart-city/shared';

import { BrandMark } from '@/components/shell/brand-mark';
import { LanguageSwitcher } from '@/components/shell/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Icon, type IconName } from '@/components/ui/icon';
import { getLocale, getTranslator } from '@/lib/i18n/server';

import packageJson from '../../../../package.json';

const MODULES: readonly {
  icon: IconName;
  label: 'adminNav.reports' | 'adminNav.notices' | 'adminNav.employees' | 'adminNav.departments';
}[] = [
  { icon: 'reports', label: 'adminNav.reports' },
  { icon: 'notices', label: 'adminNav.notices' },
  { icon: 'employees', label: 'adminNav.employees' },
  { icon: 'departments', label: 'adminNav.departments' },
];

/**
 * Sign-in, password reset and staff access. Static chrome only: nothing here reads the
 * session, so it is prerendered per language; each page reads what it needs inside its own
 * Suspense boundary.
 *
 * The form sits on the open canvas; the ink showcase (desktop) carries the product identity.
 */
export default async function AuthLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();
  const t = await getTranslator();

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-(--header-height) items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-semibold tracking-tight text-foreground">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher
              current={locale}
              label={t('adminShell.changeLanguage')}
              options={SUPPORTED_LOCALES.map((option) => ({
                locale: option,
                label: t(`language.${option}`),
              }))}
            />
            <ThemeToggle
              labels={{
                dark: t('common.darkMode'),
                light: t('common.lightMode'),
                group: t('adminShell.theme'),
              }}
            />
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 py-10 md:items-center md:px-8">
          <div className="w-full max-w-[400px] animate-enter">{children}</div>
        </main>
        <footer className="px-4 pb-6 text-xs text-subtle tabular-nums md:px-8 lg:hidden">
          {t('adminShell.version', { version: packageJson.version })}
        </footer>
      </div>

      {/* The showcase: the product's ink surface, inset like the dashboard sheet. */}
      <aside className="relative isolate m-3 hidden flex-col justify-between overflow-hidden rounded-2xl ink-surface p-10 shadow-lg lg:flex xl:p-14">
        <div aria-hidden className="absolute inset-0 -z-10 grid-lines" />
        <div
          aria-hidden
          className="absolute -end-24 -top-24 -z-10 size-96 rounded-full bg-[radial-gradient(circle,rgb(45_212_191/0.25),transparent_65%)]"
        />

        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <div className="leading-tight">
            <p className="text-md font-semibold text-white">{t('app.name')}</p>
            <p className="text-sm text-white/55">{t('adminShell.productTagline')}</p>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#5eead4] ring-1 ring-white/15 ring-inset">
            <Icon name="roles" className="size-3.5" />
            {t('adminShell.productTagline')}
          </p>
          <p className="mt-5 text-3xl leading-tight font-semibold tracking-[-0.03em] text-white xl:text-4xl xl:leading-[1.2]">
            {t('adminOverview.subtitle')}
          </p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-2.5">
            {MODULES.map((module) => (
              <li
                key={module.label}
                className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white/85 ring-1 ring-white/10 backdrop-blur ring-inset"
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-[#5eead4]">
                  <Icon name={module.icon} className="size-4" />
                </span>
                <span className="truncate">{t(module.label)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* A skyline on the horizon: decorative. */}
        <svg
          aria-hidden
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 w-full text-white/[0.07]"
          fill="currentColor"
        >
          <path d="M0 120V84h28V60h22v24h18V40h30v44h16V70h24v14h20V28h34v56h14V64h26v20h22V48h28v36h18V18h36v66h16V58h24v26h20V44h30v40h18V66h22v18h26V34h32v50h20V74h24v46z" />
        </svg>
        <p className="text-xs text-white/40 tabular-nums">
          {t('adminShell.version', { version: packageJson.version })}
        </p>
      </aside>
    </div>
  );
}
