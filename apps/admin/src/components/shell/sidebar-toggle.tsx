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
        'group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-muted',
        'transition-colors duration-150 hover:bg-sidebar-hover hover:text-foreground',
        'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
        'rail:mx-auto rail:size-10 rail:justify-center rail:px-0',
      )}
    >
      <Icon
        name="sidebar"
        className={cn('size-[18px] transition-transform duration-200', collapsed && 'rotate-180')}
      />
      <span className="truncate rail:sr-only">{label}</span>
    </button>
  );
}
