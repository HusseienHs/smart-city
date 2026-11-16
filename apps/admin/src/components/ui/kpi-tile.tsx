import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import type { IconName } from './icon';
import { IconTile } from './panel';

type KpiTone = 'primary' | 'info' | 'success' | 'warning' | 'violet' | 'neutral';

interface KpiTileProps {
  label: string;
  /** The formatted value. Pass `null` while no real value exists: an em dash is shown. */
  value: string | null;
  icon?: IconName;
  tone?: KpiTone;
  /** Context under the value: a comparison, a period or why the value is missing. */
  hint?: ReactNode;
  className?: string;
}

/**
 * A headline figure. Without a value it shows an em dash over a flat dashed baseline, so an
 * empty metric never looks like a real zero.
 */
export function KpiTile({ label, value, icon, tone = 'neutral', hint, className }: KpiTileProps) {
  return (
    <div className={cn('relative flex flex-col overflow-hidden card p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-muted">{label}</p>
        {icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null}
      </div>
      <p className="mt-4 text-3xl leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums sm:mt-5 sm:text-4xl">
        {value ?? <span className="text-subtle">—</span>}
      </p>
      {value === null ? (
        <div
          aria-hidden
          className="mt-4 h-px w-full border-t border-dashed border-border-strong sm:mt-5"
        />
      ) : null}
      {hint ? <div className="mt-3 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
