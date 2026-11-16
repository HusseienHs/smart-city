'use client';

import { useSyncExternalStore } from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { readSidebarCollapsed, setSidebarCollapsed, subscribeSidebar } from '@/lib/sidebar';

/** Collapses the desktop sidebar to an icon rail, or expands it again. */
export function SidebarToggle({ labels }: { labels: { collapse: string; expand: string } }) {
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  const label = collapsed ? labels.expand : labels.collapse;

  return (
    <button
      type="button"
      onClick={() => setSidebarCollapsed(!collapsed)}
      aria-pressed={collapsed}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted',
        'transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-accent/60 focus-visible:outline-none',
        'rail:size-11',
      )}
    >
      <Icon
        name="sidebar"
        className={cn('size-[18px] transition-transform duration-200', collapsed && 'rotate-180')}
      />
    </button>
  );
}
