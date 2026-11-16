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

/** The municipality's emblem: its initial on a quiet tile. */
function Emblem({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md border text-sm font-semibold',
        muted
          ? 'border-border bg-surface-muted text-muted'
          : 'border-primary-soft-border bg-primary-soft text-accent',
      )}
    >
      {Array.from(name.trim())[0] ?? '·'}
    </span>
  );
}

function Summary({
  option,
  labels,
  className,
}: {
  option: MunicipalityOption;
  labels: MunicipalityContextProps['labels'];
  className?: string;
}) {
  return (
    <span className={cn('min-w-0 flex-1 text-start leading-tight', className)}>
      <span className="block truncate text-sm font-semibold text-foreground">{option.name}</span>
      <span className="mt-0.5 block truncate text-2xs text-muted">
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
    'flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface p-2 text-start shadow-xs',
    rail &&
      'rail:justify-center rail:border-transparent rail:bg-transparent rail:p-0 rail:shadow-none',
  );

  if (!current) {
    return (
      <div className={box} title={rail ? labels.platformAdmin : undefined}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-violet-border bg-violet-soft text-violet">
          <Icon name="roles" className="size-4" />
        </span>
        <span className={cn('truncate text-sm font-semibold text-foreground', railHidden)}>
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
          'transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong',
          'focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none',
          open && 'border-border-strong',
        )}
      >
        <Emblem name={current.name} muted={current.suspended} />
        <Summary option={current} labels={labels} className={railHidden} />
        <Icon name="chevronsUpDown" className={cn('size-4 text-subtle', railHidden)} />
      </button>
      {open ? (
        <div
          id={panelId}
          className={cn(
            menuPanelClasses('stretch'),
            'mt-1.5',
            rail && 'rail:inset-x-auto rail:start-0 rail:w-64',
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
                      <Emblem name={option.name} muted={option.suspended} />
                      <Summary option={option} labels={labels} />
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
