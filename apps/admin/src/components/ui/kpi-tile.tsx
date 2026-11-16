import type { ReactNode } from 'react';

import { Icon, type IconName } from './icon';

interface KpiTileProps {
  label: string;
  /** The formatted value. Pass `null` while no real value exists: an em dash is shown. */
  value: string | null;
  icon?: IconName;
  /** Context under the value: a comparison, a period or why the value is missing. */
  hint?: ReactNode;
}

export function KpiTile({ label, value, icon, hint }: KpiTileProps) {
  return (
    <div className="flex flex-col card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="flex size-7 items-center justify-center rounded-sm border border-border bg-surface-subtle text-muted">
            <Icon name={icon} className="size-4" />
          </span>
        ) : null}
        <p className="truncate text-sm font-medium text-muted">{label}</p>
      </div>
      <p className="mt-4 text-3xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
        {value ?? <span className="text-subtle">—</span>}
      </p>
      {hint ? <div className="mt-2.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
