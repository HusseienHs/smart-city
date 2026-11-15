'use client';

import type { Locale } from '@smart-city/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { usePopover } from '@/components/ui/use-popover';
import { signOutAction } from '@/lib/auth/actions';
import { cn } from '@/lib/cn';

interface UserMenuProps {
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase() || '?';
}

export function UserMenu({
  locale,
  name,
  email,
  role,
  municipality,
  accountHref,
  accessHref,
  pendingInvitations,
  labels,
}: UserMenuProps) {
  const { open, setOpen, toggleOpen, containerRef, toggleRef, panelId } = usePopover();
  const item =
    'flex h-9 w-full items-center gap-2.5 rounded-sm px-3 text-base text-foreground transition-colors hover:bg-surface-muted';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        aria-label={`${labels.menu}: ${name}`}
        className="flex items-center gap-2 rounded-full p-0.5 pe-1 transition-colors hover:bg-surface-muted sm:pe-2"
      >
        <span className="relative flex size-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
          {initials(name)}
          {pendingInvitations > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
          ) : null}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-foreground sm:block">
          {name}
        </span>
        <Icon
          name="chevronDown"
          className={cn(
            'hidden size-3.5 text-muted transition-transform sm:block',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute end-0 top-full z-40 mt-2 w-72 animate-popover-in rounded-md border border-border bg-surface p-1 shadow-md"
        >
          <div className="border-b border-border px-3 pt-2 pb-3">
            <p className="truncate font-semibold text-foreground">{name}</p>
            {email ? (
              <p className="truncate text-sm text-muted">
                <bdi>{email}</bdi>
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="primary">{role}</Badge>
              {municipality ? <Badge>{municipality}</Badge> : null}
            </div>
          </div>
          <div className="py-1">
            <Link href={accountHref} className={item} onClick={() => setOpen(false)}>
              <Icon name="account" className="size-4 text-muted" />
              {labels.account}
            </Link>
            <Link href={accessHref} className={item} onClick={() => setOpen(false)}>
              <Icon name="mail" className="size-4 text-muted" />
              <span className="flex-1">{labels.invitations}</span>
              {pendingInvitations > 0 ? <Badge tone="primary">{pendingInvitations}</Badge> : null}
            </Link>
          </div>
          <form action={signOutAction} className="border-t border-border pt-1">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={cn(item, 'text-danger hover:bg-danger-soft')}>
              <Icon name="signOut" className="size-4" />
              {labels.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
