'use client';

import { DEFAULT_LOCALE } from '@smart-city/shared';
import { createTranslator } from '@smart-city/shared/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV } from '@/lib/navigation';

const t = createTranslator(DEFAULT_LOCALE);

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-e border-border bg-surface">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="size-7 rounded-lg bg-primary" aria-hidden />
        <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
      </div>
      <nav aria-label="Main" className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
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
    </aside>
  );
}
