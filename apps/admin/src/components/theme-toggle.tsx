'use client';

import { DEFAULT_LOCALE } from '@smart-city/shared';
import { createTranslator } from '@smart-city/shared/i18n';
import { useSyncExternalStore } from 'react';

import { applyTheme, readTheme, subscribeTheme, type AdminTheme } from '@/lib/theme';

const t = createTranslator(DEFAULT_LOCALE);

const SUN =
  'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 100-10 5 5 0 000 10z';
const MOON = 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z';

/** Switches the dashboard between light (default) and dark mode. */
export function ThemeToggle() {
  // Light on the server; in the browser, the theme the head script applied.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light' as const);

  const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('common.darkMode') : t('common.lightMode');

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
      }}
      aria-label={label}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
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
        <path d={next === 'dark' ? MOON : SUN} />
      </svg>
      {label}
    </button>
  );
}
