'use client';

import { useSyncExternalStore } from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { applyTheme, readTheme, subscribeTheme, type AdminTheme } from '@/lib/theme';

/**
 * A two-way light/dark switch: a sliding thumb under the sun and moon. Each option is a
 * pressed-state button named by the server-translated labels.
 */
export function ThemeToggle({
  labels,
}: {
  labels: { dark: string; light: string; group?: string };
}) {
  // Light on the server; in the browser, the theme the head script applied.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light' as const);

  const options: { value: AdminTheme; icon: 'sun' | 'moon'; label: string }[] = [
    { value: 'light', icon: 'sun', label: labels.light },
    { value: 'dark', icon: 'moon', label: labels.dark },
  ];

  return (
    <div
      role="group"
      aria-label={labels.group}
      className="relative flex h-8 items-center rounded-full bg-surface-muted p-0.5 ring-1 ring-border ring-inset"
    >
      <span
        aria-hidden
        className={cn(
          'absolute start-0.5 top-0.5 size-7 rounded-full bg-surface shadow-sm ring-1 ring-border transition-transform duration-200 ease-out-soft',
          theme === 'dark' && 'translate-x-7 rtl:-translate-x-7',
        )}
      />
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => applyTheme(option.value)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={cn(
              'relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
              active ? 'text-foreground' : 'text-subtle hover:text-foreground-secondary',
            )}
          >
            <Icon name={option.icon} className="size-[15px]" />
          </button>
        );
      })}
    </div>
  );
}
