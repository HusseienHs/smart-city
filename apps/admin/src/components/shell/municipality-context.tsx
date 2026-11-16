'use client';

import type { Locale } from '@smart-city/shared';

import { Icon } from '@/components/ui/icon';
import { MenuLabel, menuItemClasses, menuPanelClasses } from '@/components/ui/menu';
import { usePopover } from '@/components/ui/use-popover';
import { selectMunicipalityAction } from '@/lib/auth/actions';
import { cn } from '@/lib/cn';

export interface MunicipalityOption {
  id: string;
  name: string;
  role: string;
  suspended: boolean;
}

interface MunicipalityContextProps {
  locale: Locale;
  /** Null for a platform admin without a municipality. */
  current: MunicipalityOption | null;
  options: readonly MunicipalityOption[];
  /** Rendered in the icon rail: only the emblem is shown, the details become a tooltip. */
  rail?: boolean;
  labels: {
    municipality: string;
    switchMunicipality: string;
    suspended: string;
    platformAdmin: string;
  };
}

/** The municipality's emblem: its initial on a lit gradient tile. */
function Emblem({
  name,
  muted,
  size = 'md',
}: {
  name: string;
  muted?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold text-white',
        size === 'md' ? 'size-10 rounded-[11px] text-md' : 'size-8 rounded-lg text-sm',
        muted
          ? 'bg-[#3a4152]'
          : 'bg-gradient-to-br from-[#14b8a6] to-[#4f46e5] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_4px_14px_-4px_rgb(45_212_191/0.5)]',
      )}
    >
      {Array.from(name.trim())[0] ?? '·'}
    </span>
  );
}

function Summary({
  option,
  labels,
  tone = 'sidebar',
  className,
}: {
  option: MunicipalityOption;
  labels: MunicipalityContextProps['labels'];
  /** `sidebar` on the ink sidebar; `menu` inside the themed popover. */
  tone?: 'sidebar' | 'menu';
  className?: string;
}) {
  return (
    <span className={cn('min-w-0 flex-1 text-start leading-tight', className)}>
      <span
        className={cn(
          'block truncate text-sm font-semibold',
          tone === 'sidebar' ? 'text-sidebar-foreground' : 'text-foreground',
        )}
      >
        {option.name}
      </span>
      <span
        className={cn(
          'mt-1 flex items-center gap-1.5 truncate text-2xs',
          tone === 'sidebar' ? 'text-sidebar-muted' : 'text-muted',
        )}
      >
        {option.suspended ? (
          <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
        ) : null}
        {option.role}
        {option.suspended ? ` · ${labels.suspended}` : ''}
      </span>
    </span>
  );
}

/**
 * Where the staff member is working, and — with more than one membership — a switcher. The
 * chosen municipality is validated on the server against current memberships; this only asks.
 */
export function MunicipalityContext({
  locale,
  current,
  options,
  rail,
  labels,
}: MunicipalityContextProps) {
  const { open, toggleOpen, containerRef, toggleRef, panelId } = usePopover();
  const railHidden = rail ? 'rail:sr-only' : undefined;
  const box = cn(
    'flex w-full items-center gap-3 rounded-xl bg-sidebar-raised p-2.5 text-start ring-1 ring-sidebar-border ring-inset',
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]',
    rail && 'rail:justify-center rail:bg-transparent rail:p-0 rail:shadow-none rail:ring-0',
  );

  if (!current) {
    return (
      <div className={box} title={rail ? labels.platformAdmin : undefined}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#8b5cf6] to-[#4338ca] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
          <Icon name="roles" className="size-5" />
        </span>
        <span className={cn('truncate text-sm font-semibold text-sidebar-foreground', railHidden)}>
          {labels.platformAdmin}
        </span>
      </div>
    );
  }

  const switchable = options.length > 1;

  if (!switchable) {
    return (
      <div
        className={box}
        role="group"
        aria-label={labels.municipality}
        title={rail ? current.name : undefined}
      >
        <Emblem name={current.name} muted={current.suspended} />
        <Summary option={current} labels={labels} className={railHidden} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        aria-label={`${labels.switchMunicipality}: ${current.name}`}
        title={rail ? current.name : undefined}
        className={cn(
          box,
          'transition-[box-shadow,background-color] duration-150 hover:bg-sidebar-hover hover:ring-white/15',
          'focus-visible:ring-2 focus-visible:ring-sidebar-accent/60 focus-visible:outline-none',
          open && 'bg-sidebar-hover ring-white/15',
        )}
      >
        <Emblem name={current.name} muted={current.suspended} />
        <Summary option={current} labels={labels} className={railHidden} />
        <Icon name="chevronsUpDown" className={cn('size-4 text-sidebar-muted', railHidden)} />
      </button>
      {open ? (
        <div
          id={panelId}
          className={cn(
            menuPanelClasses('stretch'),
            'mt-1.5',
            'min-w-64',
            rail && 'rail:inset-x-auto rail:start-0 rail:w-72',
          )}
        >
          <MenuLabel>{labels.switchMunicipality}</MenuLabel>
          <ul className="max-h-80 scrollbar-thin overflow-y-auto">
            {options.map((option) => {
              const selected = option.id === current.id;
              return (
                <li key={option.id}>
                  <form action={selectMunicipalityAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="municipalityId" value={option.id} />
                    <button
                      type="submit"
                      aria-current={selected ? 'true' : undefined}
                      className={cn(menuItemClasses(false), 'gap-2.5 py-1.5')}
                    >
                      <Emblem name={option.name} muted={option.suspended} size="sm" />
                      <Summary option={option} labels={labels} tone="menu" />
                      {selected ? <Icon name="check" className="size-4 text-accent" /> : null}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
