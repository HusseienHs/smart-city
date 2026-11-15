import type { StaffColleague, StaffDirectory } from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';

import { localizedText } from '@/lib/i18n/localized-text';

type Translate = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string;

/**
 * Display names for the ids on a report, in the dashboard language. Names of people come only
 * from get_colleagues (active staff); anyone else is "former staff member" — reporters are
 * never identified.
 */
export interface ReportLabels {
  department(id: string | null): string;
  category(id: string): string;
  neighborhood(id: string | null): string | null;
  /** An assignee: "unassigned" when there is none. */
  person(employeeId: string | null): string;
  /** The staff author of a comment or status change: "former staff" when no longer known. */
  author(employeeId: string | null): string;
}

export function reportLabels(
  directory: StaffDirectory,
  colleagues: readonly StaffColleague[],
  locale: Locale,
  t: Translate,
): ReportLabels {
  const departments = new Map(directory.departments.map((d) => [d.id, d]));
  const neighborhoods = new Map(directory.neighborhoods.map((n) => [n.id, n]));
  const categories = new Map(directory.categories.map((c) => [c.id, c]));
  const people = new Map(colleagues.map((c) => [c.employee_id, c]));
  const author = (employeeId: string | null): string => {
    const colleague = employeeId ? people.get(employeeId) : undefined;
    if (!colleague) return t('adminReports.people.formerStaff');
    return colleague.full_name?.trim() || t('adminReports.people.unnamedStaff');
  };

  return {
    department(id) {
      if (!id) return t('adminReports.people.intake');
      const entry = departments.get(id);
      if (!entry) return t('adminReports.people.unknown');
      const name = localizedText(entry.name, locale);
      return entry.isActive ? name : t('adminReports.people.inactive', { name });
    },
    category(id) {
      const entry = categories.get(id);
      return entry ? localizedText(entry.name, locale) : t('adminReports.people.unknown');
    },
    neighborhood(id) {
      if (!id) return null;
      const entry = neighborhoods.get(id);
      return entry ? localizedText(entry.name, locale) : null;
    },
    person(employeeId) {
      return employeeId ? author(employeeId) : t('adminReports.people.unassigned');
    },
    author,
  };
}
