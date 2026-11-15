'use client';

import type { Locale } from '@smart-city/shared';

import { Icon } from '@/components/ui/icon';
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
  labels: {
    municipality: string;
    switchMunicipality: string;
    suspended: string;
    platformAdmin: string;
  };
}

function Summary({
  option,
  labels,
}: {
  option: MunicipalityOption;
  labels: MunicipalityContextProps['labels'];
}) {
  return (
    <span className="min-w-0 flex-1 text-start">
      <span className="block truncate text-sm font-semibold text-white">{option.name}</span>
      <span className="block truncate text-xs text-navy-muted">
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
  labels,
}: MunicipalityContextProps) {
  const { open, toggleOpen, containerRef, toggleRef, panelId } = usePopover();

  if (!current) {
    return (
      <p className="flex items-center gap-2 px-1 text-sm font-medium text-white">
        <Icon name="roles" className="size-4 text-navy-accent" />
        {labels.platformAdmin}
      </p>
    );
  }

  const switchable = options.length > 1;
  const box =
    'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 transition-colors duration-150';

  if (!switchable) {
    return (
      <div className={box} aria-label={labels.municipality}>
        <Icon name="departments" className="size-[18px] text-navy-muted" />
        <Summary option={current} labels={labels} />
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
        className={cn(box, 'bg-navy-hover hover:bg-navy-active')}
      >
        <Icon name="departments" className="size-[18px] text-navy-muted" />
        <Summary option={current} labels={labels} />
        <Icon
          name="chevronDown"
          className={cn('size-4 text-navy-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <ul
          id={panelId}
          className="absolute inset-x-0 top-full z-40 mt-1.5 animate-popover-in rounded-md border border-border bg-surface p-1 text-foreground shadow-lg"
        >
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
                    className={cn(
                      'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-start transition-colors',
                      selected ? 'bg-primary-soft' : 'hover:bg-surface-muted',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm font-medium',
                          selected && 'text-primary',
                        )}
                      >
                        {option.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {option.role}
                        {option.suspended ? ` · ${labels.suspended}` : ''}
                      </span>
                    </span>
                    {selected ? <Icon name="check" className="size-4 text-primary" /> : null}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
