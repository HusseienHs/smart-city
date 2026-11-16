'use client';

import type { Locale } from '@smart-city/shared';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { menuItemClasses, menuPanelClasses } from '@/components/ui/menu';
import { usePopover } from '@/components/ui/use-popover';
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
  const { open, setOpen, toggleOpen, containerRef, toggleRef, panelId } = usePopover();
  const pathname = usePathname();
  const currentLabel = options.find((option) => option.locale === current)?.label ?? current;

  function choose(event: MouseEvent<HTMLAnchorElement>, locale: Locale) {
    event.preventDefault();
    setOpen(false);
    if (locale !== current) switchLanguage(locale, pathname);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${currentLabel}`}
        className={cn(buttonClasses({ variant: 'ghost', size: 'sm' }), open && 'bg-surface-muted')}
      >
        <Icon name="language" className="size-4" />
        <span className="max-sm:sr-only">{currentLabel}</span>
        <Icon
          name="chevronDown"
          className={cn(
            'size-3.5 opacity-60 transition-transform duration-150 max-sm:hidden',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul id={panelId} className={cn(menuPanelClasses('end'), 'w-48')}>
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
                    menuItemClasses(selected),
                    'justify-between',
                    selected && 'font-medium',
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
