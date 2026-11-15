import type { Locale } from '@smart-city/shared';
import { messages, type Messages } from '@smart-city/shared/i18n';

/** Message namespaces the staff screens' Client Components need (one language only). */
const NAMESPACES = [
  'adminStaff',
  'adminDepartments',
  'adminEmployees',
  'adminInvitations',
  'adminJoin',
  'staffRole',
  'apiErrors',
  'auth',
  'authErrors',
] as const;

export type StaffStrings = Pick<Messages, (typeof NAMESPACES)[number]>;

export function staffStrings(locale: Locale): StaffStrings {
  const source = messages[locale];
  return Object.fromEntries(NAMESPACES.map((ns) => [ns, source[ns]])) as StaffStrings;
}
