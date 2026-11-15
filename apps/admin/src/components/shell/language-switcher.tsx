'use client';

import type { Locale } from '@smart-city/shared';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { switchLocalePath } from '@/lib/i18n/routing';
import { switchLanguage } from '@/lib/i18n/switch-language';

export interface LanguageOption {
  locale: Locale;
  /** The language's own name (עברית, العربية, English). */
  label: string;
}

interface LanguageSwitcherProps {
  current: Locale;
  options: readonly LanguageOption[];
  /** Accessible name of the toggle, e.g. "Change language". */
  label: string;
}

/**
 * Switches the dashboard language and direction, keeping the current page. The choice is
 * remembered in a cookie so that unprefixed URLs open in it next time.
 */
export function LanguageSwitcher({ current, options, label }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const pathname = usePathname();
  const currentLabel = options.find((option) => option.locale === current)?.label ?? current;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(event: MouseEvent<HTMLAnchorElement>, locale: Locale) {
    event.preventDefault();
    setOpen(false);
    if (locale !== current) switchLanguage(locale, pathname);
  }

  return (
    <div ref={container} className="relative">
      <button
        ref={toggle}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${currentLabel}`}
        className={buttonClasses({ variant: 'ghost', size: 'sm' })}
      >
        <Icon name="language" className="size-4" />
        <span className="max-sm:sr-only">{currentLabel}</span>
        <Icon
          name="chevronDown"
          className={cn('size-3.5 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <ul
          id={listId}
          className="absolute end-0 top-full z-40 mt-2 w-48 animate-popover-in rounded-md border border-border bg-surface p-1 shadow-md"
        >
          {options.map((option) => {
            const selected = option.locale === current;
            return (
              <li key={option.locale}>
                <a
                  href={switchLocalePath(pathname, option.locale)}
                  hrefLang={option.locale}
                  lang={option.locale}
                  aria-current={selected ? 'true' : undefined}
                  onClick={(event) => choose(event, option.locale)}
                  className={cn(
                    'flex h-9 items-center justify-between gap-3 rounded-sm px-3 text-base transition-colors duration-150',
                    selected
                      ? 'bg-primary-soft font-medium text-primary'
                      : 'text-foreground hover:bg-surface-muted',
                  )}
                >
                  {option.label}
                  {selected ? <Icon name="check" className="size-4" /> : null}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
