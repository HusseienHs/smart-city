'use client';

import { useSyncExternalStore } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { applyTheme, readTheme, subscribeTheme, type AdminTheme } from '@/lib/theme';

/**
 * Switches the dashboard between light and dark. The label names the theme it switches to,
 * translated on the server.
 */
export function ThemeToggle({ labels }: { labels: { dark: string; light: string } }) {
  // Light on the server; in the browser, the theme the head script applied.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light' as const);

  const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? labels.dark : labels.light;

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={label}
      title={label}
      className={buttonClasses({ variant: 'ghost', size: 'sm', iconOnly: true })}
    >
      <Icon name={next === 'dark' ? 'moon' : 'sun'} className="size-4" />
    </button>
  );
}
