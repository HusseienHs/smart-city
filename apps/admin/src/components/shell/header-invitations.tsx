import Link from 'next/link';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

/**
 * The header's notification bell. Its only real source today is pending staff invitations:
 * the count comes from the server and the bell opens the invitations page.
 */
export function HeaderInvitations({
  href,
  count,
  label,
}: {
  href: string;
  count: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label} (${count})` : label}
      title={label}
      className={cn(
        'relative flex size-8 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-border ring-inset',
        'transition-[color,box-shadow] duration-150 hover:text-foreground hover:ring-border-strong',
        'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
      )}
    >
      <Icon name="bell" className="size-4" />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary tabular-nums ring-2 ring-background"
        >
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  );
}
