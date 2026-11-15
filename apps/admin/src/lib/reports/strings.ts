import type { Locale } from '@smart-city/shared';
import { messages, type MessageKey, type Messages } from '@smart-city/shared/i18n';

/**
 * The message namespaces the report screens' Client Components need. Only these are sent to
 * the browser (one language), instead of every message of every language.
 */
const NAMESPACES = [
  'adminReports',
  'reportStatus',
  'reportPriority',
  'reportRejectionReason',
  'apiErrors',
  'common',
] as const;

export type ReportStrings = Pick<Messages, (typeof NAMESPACES)[number]>;

export function reportStrings(locale: Locale): ReportStrings {
  const source = messages[locale];
  return Object.fromEntries(NAMESPACES.map((ns) => [ns, source[ns]])) as ReportStrings;
}

export type ClientTranslator = (
  key: MessageKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

/** A translator over the strings passed from the server. Unknown keys render as the key. */
export function translatorFor(strings: Partial<Messages>): ClientTranslator {
  return (key, params) => {
    let node: unknown = strings;
    for (const part of key.split('.')) {
      node =
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined;
    }
    const template = typeof node === 'string' ? node : key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
