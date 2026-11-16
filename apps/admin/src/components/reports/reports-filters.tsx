import type { StaffDirectory } from '@smart-city/api';
import { REPORT_PRIORITIES, REPORT_STATUSES, type Locale } from '@smart-city/shared';
import type { Translator } from '@smart-city/shared/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { REPORT_STATUS_TONES } from '@/components/report-status-badge';
import { badgeDotClass } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { controlClasses, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { localizedText } from '@/lib/i18n/localized-text';
import {
  DEFAULT_DIRECTION,
  DEFAULT_SORT,
  activeFilterKeys,
  filtersQuery,
  withoutFilter,
  type FilterKey,
  type ReportFilters,
} from '@/lib/reports/filters';
import type { ReportLabels } from '@/lib/reports/labels';

import { PrioritySignal } from './report-priority-badge';

/** A status toggle in the segmented strip: a checkbox styled as a tab. */
const SEGMENT =
  'relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium ' +
  'text-muted transition-[background-color,color,box-shadow] duration-150 select-none ' +
  'hover:text-foreground hover:bg-surface/60 ' +
  'has-checked:bg-surface has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-border ' +
  'has-focus-visible:ring-2 has-focus-visible:ring-focus-ring';

/** A priority toggle: a compact outlined chip. */
const CHIP =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong/80 bg-surface px-3 text-sm font-medium ' +
  'text-foreground-secondary shadow-xs transition-[background-color,border-color,color] duration-150 select-none ' +
  'hover:border-border-strong hover:text-foreground ' +
  'has-checked:border-primary has-checked:bg-primary-soft has-checked:text-accent ' +
  'has-focus-visible:ring-4 has-focus-visible:ring-focus-ring';

export interface FilterOptions {
  showDepartment: boolean;
  showAssignedToMe: boolean;
  showUnassigned: boolean;
}

/**
 * The filter form. A plain GET form: it works without JavaScript and every view is a URL.
 * Sorting is carried along; applying filters returns to page 1. The less frequent filters sit
 * in a native disclosure that starts open whenever one of them is in use.
 */
export function ReportsFilters({
  filters,
  directory,
  locale,
  t,
  baseHref,
  options,
}: {
  filters: ReportFilters;
  directory: StaffDirectory;
  locale: Locale;
  t: Translator;
  baseHref: string;
  options: FilterOptions;
}) {
  const departments = directory.departments.filter(
    (d) => d.isActive || d.id === filters.departmentId,
  );
  const neighborhoods = directory.neighborhoods.filter(
    (n) => n.isActive || n.id === filters.neighborhoodId,
  );
  const showAssignment = options.showAssignedToMe || options.showUnassigned;
  const moreActive = Boolean(
    filters.departmentId ||
    filters.categoryId ||
    filters.neighborhoodId ||
    filters.assignment ||
    filters.from ||
    filters.to,
  );

  return (
    <form method="get" action={baseHref} role="search" className="flex flex-col">
      {filters.sort !== DEFAULT_SORT ? (
        <input type="hidden" name="sort" value={filters.sort} />
      ) : null}
      {filters.direction !== DEFAULT_DIRECTION ? (
        <input type="hidden" name="dir" value={filters.direction} />
      ) : null}

      {/* Status: a segmented strip across the top of the workspace. */}
      <fieldset className="border-b border-border bg-surface-subtle px-3 py-2.5 sm:px-4">
        <legend className="sr-only">{t('adminReports.columns.status')}</legend>
        <div className="-m-1 flex scrollbar-thin gap-1 overflow-x-auto p-1">
          {REPORT_STATUSES.map((status) => (
            <label key={status} className={SEGMENT}>
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={filters.statuses.includes(status)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn('size-2 rounded-full', badgeDotClass(REPORT_STATUS_TONES[status]))}
              />
              {t(`reportStatus.${status}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Search, priority and the actions. */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
        <label className="sr-only" htmlFor="reports-search">
          {t('adminReports.list.searchLabel')}
        </label>
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
          />
          <input
            id="reports-search"
            type="search"
            name="q"
            defaultValue={filters.search}
            maxLength={100}
            placeholder={t('adminReports.list.searchPlaceholder')}
            className={controlClasses(false, 'ps-10 pe-3')}
          />
        </div>

        <fieldset className="flex min-w-0 items-center gap-2">
          <legend className="sr-only">{t('adminReports.columns.priority')}</legend>
          <div className="flex scrollbar-thin gap-1.5 overflow-x-auto">
            {REPORT_PRIORITIES.map((priority) => (
              <label key={priority} className={CHIP}>
                <input
                  type="checkbox"
                  name="priority"
                  value={priority}
                  defaultChecked={filters.priorities.includes(priority)}
                  className="sr-only"
                />
                <PrioritySignal priority={priority} />
                {t(`reportPriority.${priority}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" variant="primary" icon="filter" className="h-10">
            {t('adminReports.list.apply')}
          </Button>
          {activeFilterKeys(filters).length > 0 ? (
            <ButtonLink
              href={`${baseHref}${filtersQuery(filters, CLEARED)}`}
              variant="ghost"
              className="h-10"
            >
              {t('adminReports.list.clear')}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {/* The less frequent filters: a native disclosure that starts open when one is in use. */}
      <details className="group/more border-t border-border" open={moreActive}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted transition-colors select-none hover:text-foreground sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex size-6 items-center justify-center rounded-md bg-surface-muted ring-1 ring-border ring-inset">
            <Icon name="settings" className="size-3.5" />
          </span>
          {t('adminReports.list.moreFilters')}
          <Icon
            name="chevronDown"
            className="size-3.5 transition-transform duration-200 group-open/more:rotate-180"
          />
        </summary>
        <div className="grid animate-fade-in gap-4 border-t border-dashed border-border bg-surface-subtle px-4 pt-4 pb-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-6">
          {options.showDepartment ? (
            <SelectField
              id="filter-department"
              name="department"
              label={t('adminReports.columns.department')}
              value={filters.departmentId}
              anyLabel={t('adminReports.list.any')}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.isActive
                    ? localizedText(d.name, locale)
                    : t('adminReports.people.inactive', { name: localizedText(d.name, locale) })}
                </option>
              ))}
            </SelectField>
          ) : null}
          <SelectField
            id="filter-category"
            name="category"
            label={t('adminReports.columns.category')}
            value={filters.categoryId}
            anyLabel={t('adminReports.list.any')}
          >
            {directory.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {localizedText(c.name, locale)}
              </option>
            ))}
          </SelectField>
          {neighborhoods.length > 0 ? (
            <SelectField
              id="filter-neighborhood"
              name="neighborhood"
              label={t('adminReports.detail.neighborhood')}
              value={filters.neighborhoodId}
              anyLabel={t('adminReports.list.any')}
            >
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {localizedText(n.name, locale)}
                </option>
              ))}
            </SelectField>
          ) : null}
          {showAssignment ? (
            <SelectField
              id="filter-assignment"
              name="assignment"
              label={t('adminReports.list.assignment')}
              value={filters.assignment}
              anyLabel={t('adminReports.list.any')}
            >
              {options.showAssignedToMe ? (
                <option value="me">{t('adminReports.list.assignedToMe')}</option>
              ) : null}
              {options.showUnassigned ? (
                <option value="unassigned">{t('adminReports.list.unassigned')}</option>
              ) : null}
            </SelectField>
          ) : null}
          <DateField
            id="filter-from"
            name="from"
            label={t('adminReports.list.createdFrom')}
            value={filters.from}
          />
          <DateField
            id="filter-to"
            name="to"
            label={t('adminReports.list.createdTo')}
            value={filters.to}
          />
        </div>
      </details>
    </form>
  );
}

const CLEARED: Partial<ReportFilters> = {
  search: undefined,
  statuses: [],
  priorities: [],
  departmentId: undefined,
  categoryId: undefined,
  neighborhoodId: undefined,
  assignment: undefined,
  from: undefined,
  to: undefined,
};

function SelectField({
  id,
  name,
  label,
  value,
  anyLabel,
  children,
}: {
  id: string;
  name: string;
  label: string;
  value: string | undefined;
  anyLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-foreground-secondary">
        {label}
      </label>
      <Select id={id} name={name} defaultValue={value ?? ''}>
        <option value="">{anyLabel}</option>
        {children}
      </Select>
    </div>
  );
}

function DateField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-foreground-secondary">
        {label}
      </label>
      <input
        id={id}
        type="date"
        name={name}
        defaultValue={value}
        className={controlClasses(false, 'px-3')}
      />
    </div>
  );
}

/** The active filters as removable chips. */
export function ActiveFilters({
  filters,
  labels,
  locale,
  t,
  baseHref,
}: {
  filters: ReportFilters;
  labels: ReportLabels;
  locale: Locale;
  t: Translator;
  baseHref: string;
}) {
  const keys = activeFilterKeys(filters);
  if (keys.length === 0) return null;

  const describe = (key: FilterKey): string => {
    switch (key) {
      case 'search':
        return `“${filters.search}”`;
      case 'statuses':
        return filters.statuses.map((s) => t(`reportStatus.${s}`)).join(', ');
      case 'priorities':
        return filters.priorities.map((p) => t(`reportPriority.${p}`)).join(', ');
      case 'departmentId':
        return labels.department(filters.departmentId ?? null);
      case 'categoryId':
        return labels.category(filters.categoryId!);
      case 'neighborhoodId':
        return (
          labels.neighborhood(filters.neighborhoodId ?? null) ?? t('adminReports.people.unknown')
        );
      case 'assignment':
        return filters.assignment === 'me'
          ? t('adminReports.list.assignedToMe')
          : t('adminReports.list.unassigned');
      case 'from':
        return `${t('adminReports.list.createdFrom')} ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(filters.from!))}`;
      case 'to':
        return `${t('adminReports.list.createdTo')} ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(filters.to!))}`;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 sm:px-5">
      <span className="me-1 flex items-center gap-1.5 text-sm font-medium text-muted">
        <Icon name="filter" className="size-3.5" />
        {t('adminReports.list.activeFilters', { count: keys.length })}
      </span>
      {keys.map((key) => {
        const text = describe(key);
        return (
          <Link
            key={key}
            href={`${baseHref}${filtersQuery(filters, withoutFilter(filters, key))}`}
            className="group inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary-soft ps-3 pe-1.5 text-xs font-medium text-accent ring-1 ring-primary-soft-border transition-colors ring-inset hover:ring-accent/50"
            aria-label={t('adminReports.list.removeFilter', { filter: text })}
          >
            <span className="truncate">{text}</span>
            <span className="flex size-4 items-center justify-center rounded-full bg-accent/10 transition-colors group-hover:bg-accent/20">
              <Icon name="close" className="size-3" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
