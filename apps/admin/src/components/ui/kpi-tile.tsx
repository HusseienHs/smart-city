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
    <div className="rounded-lg border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <Icon name={icon} className="size-[18px] text-subtle" /> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value ?? <span className="text-subtle">—</span>}
      </p>
      {hint ? <div className="mt-2 text-sm text-muted">{hint}</div> : null}
    </div>
  );
}
