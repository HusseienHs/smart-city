'use client';

import { DEFAULT_LOCALE } from '@smart-city/shared';
import { createTranslator } from '@smart-city/shared/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV } from '@/lib/navigation';

import { ThemeToggle } from './theme-toggle';

const t = createTranslator(DEFAULT_LOCALE);

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-e border-border bg-surface">
      <div className="flex h-16 items-center gap-3 px-5">
        <span
          className="flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 21V9l6-4v16M10 21V5l10 4v12M3 21h18M14 11h2M14 15h2" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="truncate text-base leading-tight font-semibold tracking-tight">
            {t('app.name')}
          </p>
          <p className="truncate text-xs text-muted">{t('app.tagline')}</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-primary"
                      aria-hidden
                    />
                  ) : null}
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={item.icon} />
                  </svg>
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-3 py-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
