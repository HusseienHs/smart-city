'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/icon';
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

/**
 * "Group › Module" for the current page. On a module's sub-page (a report, an employee…)
 * the module becomes a link back to its list.
 */
export function Breadcrumbs({
  label,
  entries,
}: {
  label: string;
  entries: readonly BreadcrumbEntry[];
}) {
  const path = stripLocale(usePathname());
  const current = entries.find((entry) => isPathInModule(path, entry.path));
  if (!current) return null;
  const onSubPage = path !== current.path;

  return (
    <nav aria-label={label}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        <li className="shrink-0 text-muted max-sm:hidden">{current.group}</li>
        <li aria-hidden className="shrink-0 text-subtle max-sm:hidden">
          <Icon name="chevronEnd" className="size-3.5" />
        </li>
        <li className="min-w-0">
          {onSubPage ? (
            <Link
              href={current.href}
              className="block truncate rounded-xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
            >
              {current.label}
            </Link>
          ) : (
            <span aria-current="page" className="block truncate font-medium text-foreground">
              {current.label}
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}
