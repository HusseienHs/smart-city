'use client';

import type { Locale } from '@smart-city/shared';
import Link from 'next/link';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { MenuSeparator, menuItemClasses, menuPanelClasses } from '@/components/ui/menu';
import { usePopover } from '@/components/ui/use-popover';
import { signOutAction } from '@/lib/auth/actions';
import { cn } from '@/lib/cn';

export interface UserMenuProps {
  locale: Locale;
  name: string;
  email: string | null;
  role: string;
  municipality: string | null;
  accountHref: string;
  accessHref: string;
  pendingInvitations: number;
  labels: {
    menu: string;
    account: string;
    invitations: string;
    signOut: string;
  };
}

/**
 * The signed-in staff member and their account menu. `sidebar` is the full-width row at the
 * bottom of the sidebar (opens upward; collapses to the avatar in the icon rail); `header` is
 * the avatar button in the top bar on phones, where the sidebar is hidden.
 */
export function UserMenu({
  placement,
  rail,
  locale,
  name,
  email,
  role,
  municipality,
  accountHref,
  accessHref,
  pendingInvitations,
  labels,
}: UserMenuProps & { placement: 'sidebar' | 'header'; rail?: boolean }) {
  const { open, setOpen, toggleOpen, containerRef, toggleRef, panelId } = usePopover();
  const inSidebar = placement === 'sidebar';
  const railHidden = rail ? 'rail:sr-only' : undefined;

  const avatar = (
    <span className="relative">
      <Avatar name={name} size={inSidebar ? 'sm' : 'md'} />
      {pendingInvitations > 0 ? (
        <span
          aria-hidden
          className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary"
        />
      ) : null}
    </span>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        aria-label={`${labels.menu}: ${name}`}
        title={rail ? name : undefined}
        className={cn(
          'flex items-center text-start transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
          inSidebar
            ? cn(
                'w-full gap-2.5 rounded-md p-1.5 hover:bg-sidebar-hover',
                open && 'bg-sidebar-hover',
                rail && 'rail:mx-auto rail:size-10 rail:justify-center rail:p-0',
              )
            : 'rounded-full p-0.5 hover:bg-surface-muted',
        )}
      >
        {avatar}
        {inSidebar ? (
          <>
            <span className={cn('min-w-0 flex-1 leading-tight', railHidden)}>
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              <span className="mt-0.5 block truncate text-2xs text-muted">{role}</span>
            </span>
            <Icon name="chevronsUpDown" className={cn('size-4 text-subtle', railHidden)} />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className={cn(
            inSidebar ? menuPanelClasses('stretch', 'top') : menuPanelClasses('end'),
            inSidebar ? 'min-w-60' : 'w-72',
            rail && 'rail:inset-x-auto rail:start-0 rail:w-72',
          )}
        >
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-2.5">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{name}</p>
              {email ? (
                <p className="truncate text-sm text-muted">
                  <bdi>{email}</bdi>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
            <Badge tone="primary" size="sm">
              {role}
            </Badge>
            {municipality ? <Badge size="sm">{municipality}</Badge> : null}
          </div>
          <MenuSeparator />
          <Link href={accountHref} className={menuItemClasses()} onClick={() => setOpen(false)}>
            <Icon name="account" className="size-4 text-muted" />
            {labels.account}
          </Link>
          <Link href={accessHref} className={menuItemClasses()} onClick={() => setOpen(false)}>
            <Icon name="mail" className="size-4 text-muted" />
            <span className="flex-1">{labels.invitations}</span>
            {pendingInvitations > 0 ? (
              <Badge tone="primary" size="sm">
                {pendingInvitations}
              </Badge>
            ) : null}
          </Link>
          <MenuSeparator />
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className={cn(menuItemClasses(), 'text-danger hover:bg-danger-soft')}
            >
              <Icon name="signOut" className="size-4" />
              {labels.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
