import { DEFAULT_LOCALE, type Locale } from '../locales';
import { ar } from './messages/ar';
import { en } from './messages/en';
import { he } from './messages/he';
import type { MessageKey, Messages } from './types';

export type { MessageKey, Messages } from './types';

export const messages: Readonly<Record<Locale, Messages>> = { he, ar, en };

function lookup(source: Messages, key: string): string | undefined {
  let node: unknown = source;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Lightweight, dependency-free translator. Falls back to the default locale, then to
 * English, then to the key itself so a missing string never crashes the UI.
 * Interpolates `{name}` placeholders from `params`.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const template =
    lookup(messages[locale], key) ??
    lookup(messages[DEFAULT_LOCALE], key) ??
    lookup(en, key) ??
    key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslator(locale: Locale) {
  return (key: MessageKey, params?: Readonly<Record<string, string | number>>) =>
    translate(locale, key, params);
}

export type Translator = ReturnType<typeof createTranslator>;
