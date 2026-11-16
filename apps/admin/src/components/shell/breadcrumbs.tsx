'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { stripLocale } from '@/lib/i18n/routing';
import { isPathInModule } from '@/lib/navigation';

export interface BreadcrumbEntry {
  /** Module path without the locale prefix. */
  path: string;
  /** Module path with the locale prefix, used as the link target. */
  href: string;
  label: string;
  group: string;
}

/** A thin forward slash between crumbs (a slash reads the same in both directions). */
function Separator({ className }: { className?: string }) {
  return (
    <li aria-hidden className={cn('shrink-0 text-border-strong', className)}>
      <svg
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M10.5 3 5.5 13" strokeLinecap="round" />
      </svg>
    </li>
  );
}

/**
 * Home › Group › Module for the current page. On a module's sub-page (a report, an
 * employee…) the module becomes a link back to its list, followed by a "detail" dot.
 */
export function Breadcrumbs({
  label,
  home,
  entries,
}: {
  label: string;
  /** The overview: the first crumb, shown as an icon. */
  home: { href: string; label: string };
  entries: readonly BreadcrumbEntry[];
}) {
  const path = stripLocale(usePathname());
  const current = entries.find((entry) => isPathInModule(path, entry.path));
  const onSubPage = current ? path !== current.path : false;
  const isHome = current?.path === '/';

  return (
    <nav aria-label={label}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          <Link
            href={home.href}
            aria-label={home.label}
            aria-current={isHome ? 'page' : undefined}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors',
              isHome
                ? 'bg-primary-soft text-accent'
                : 'text-muted hover:bg-surface-muted hover:text-foreground',
            )}
          >
            <Icon name="overview" className="size-4" />
          </Link>
        </li>
        {current && !isHome ? (
          <>
            <Separator />
            <li className="shrink-0 text-muted max-sm:hidden">{current.group}</li>
            <Separator className="max-sm:hidden" />
            <li className="min-w-0">
              {onSubPage ? (
                <Link
                  href={current.href}
                  className="block truncate rounded-md px-1 font-medium text-foreground-secondary transition-colors hover:text-foreground"
                >
                  {current.label}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="block truncate font-semibold tracking-tight text-foreground"
                >
                  {current.label}
                </span>
              )}
            </li>
            {onSubPage ? (
              <>
                <Separator />
                <li aria-hidden className="flex shrink-0 gap-0.5">
                  <span className="size-1 rounded-full bg-subtle" />
                  <span className="size-1 rounded-full bg-subtle" />
                  <span className="size-1 rounded-full bg-subtle" />
                </li>
              </>
            ) : null}
          </>
        ) : current ? (
          <>
            <Separator />
            <li className="min-w-0">
              <span
                aria-current="page"
                className="block truncate font-semibold tracking-tight text-foreground"
              >
                {current.label}
              </span>
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
