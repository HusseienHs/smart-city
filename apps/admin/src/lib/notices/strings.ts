import type { Locale } from '@smart-city/shared';
import { messages, type Messages } from '@smart-city/shared/i18n';

/** Message namespaces the Notice Board's Client Components need (one language only). */
const NAMESPACES = ['adminNotices', 'notices', 'apiErrors'] as const;

export type NoticeStrings = Pick<Messages, (typeof NAMESPACES)[number]>;

export function noticeStrings(locale: Locale): NoticeStrings {
  const source = messages[locale];
  return Object.fromEntries(NAMESPACES.map((ns) => [ns, source[ns]])) as NoticeStrings;
}
