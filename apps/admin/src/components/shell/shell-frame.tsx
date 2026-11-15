'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

interface ShellFrameProps {
  /** The persistent sidebar (icon rail on tablets, full on desktop). */
  sidebar: ReactNode;
  /** The sidebar rendered inside the off-canvas drawer (phones and tablets). */
  drawer: ReactNode;
  breadcrumbs: ReactNode;
  /** Header controls aligned to the end edge. */
  headerEnd: ReactNode;
  labels: {
    skipToContent: string;
    navigation: string;
    openNavigation: string;
    closeNavigation: string;
  };
  children: ReactNode;
}

const DRAWER_ID = 'navigation-drawer';
/** Tailwind's `xl` breakpoint, where the full sidebar replaces the drawer. */
const DESKTOP_QUERY = '(min-width: 80rem)';

/**
 * The responsive dashboard frame:
 * - ≥1280px: full sidebar + content.
 * - 768–1279px: icon rail + content; the menu button opens the full sidebar as a drawer.
 * - <768px: content only; the menu button opens the drawer.
 */
export function ShellFrame({
  sidebar,
  drawer,
  breadcrumbs,
  headerEnd,
  labels,
  children,
}: ShellFrameProps) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Following a link inside the drawer closes it.
  const pathname = usePathname();
  const [shownPathname, setShownPathname] = useState(pathname);
  if (pathname !== shownPathname) {
    setShownPathname(pathname);
    setOpen(false);
  }

  /**
   * Closing on request returns focus to the menu button it was opened from — after the
   * re-render, because while the drawer is open the button is inside an inert container.
   */
  const restoreFocus = useRef(false);
  const close = useCallback(() => {
    restoreFocus.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (restoreFocus.current) menuButton.current?.focus();
      restoreFocus.current = false;
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  // Growing the window to desktop width closes the drawer: the full sidebar is visible.
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-sm bg-surface px-3 py-2 text-sm font-medium text-primary shadow-md focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-[60]"
      >
        {labels.skipToContent}
      </a>

      <div className="sticky top-0 hidden h-dvh shrink-0 md:block" inert={open}>
        {sidebar}
      </div>

      <div
        className={cn('fixed inset-0 z-50 xl:hidden', !open && 'pointer-events-none')}
        inert={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-navy/45 transition-opacity duration-200 ease-standard',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={close}
          aria-hidden
        />
        <div
          ref={panel}
          id={DRAWER_ID}
          role="dialog"
          aria-modal="true"
          aria-label={labels.navigation}
          className={cn(
            'absolute inset-y-0 start-0 flex shadow-lg transition-transform duration-200 ease-standard',
            open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
          )}
        >
          {drawer}
          <button
            type="button"
            onClick={close}
            aria-label={labels.closeNavigation}
            data-autofocus
            className="absolute end-2 top-2.5 flex size-9 items-center justify-center rounded-sm text-navy-foreground transition-colors hover:bg-navy-hover hover:text-white"
          >
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col" inert={open}>
        <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md md:px-6 xl:px-8">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={labels.openNavigation}
            aria-expanded={open}
            aria-controls={DRAWER_ID}
            className={cn(buttonClasses({ variant: 'ghost', iconOnly: true }), '-ms-2 xl:hidden')}
          >
            <Icon name="menu" />
          </button>
          <div className="min-w-0 flex-1">{breadcrumbs}</div>
          <div className="flex shrink-0 items-center gap-2">{headerEnd}</div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-(--content-max-width) flex-1 px-4 py-6 focus:outline-none md:px-6 xl:px-8 xl:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
