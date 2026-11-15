import type { IconName } from '@/components/ui/icon';
import type { ModuleId, NavGroupId } from '@/lib/navigation';

/** A navigation entry, already translated and localized on the server. */
export interface ShellNavItem {
  id: ModuleId;
  /** Path without the locale prefix, used for active-state matching. */
  path: string;
  /** Path with the locale prefix, used as the link target. */
  href: string;
  label: string;
  icon: IconName;
}

export interface ShellNavGroup {
  id: NavGroupId;
  label: string;
  items: readonly ShellNavItem[];
}

/**
 * `static`: the persistent sidebar — an icon rail on tablets, full width on desktop.
 * `drawer`: the full-width sidebar inside the off-canvas drawer.
 */
export type SidebarVariant = 'static' | 'drawer';
