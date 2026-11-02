import { describe, expect, it } from 'vitest';

import { getTextDirection, resolveLocale, SUPPORTED_LOCALES } from '../locales';
import { REPORT_CATEGORIES, REPORT_STATUSES } from '../reports';
import { messages, translate } from './index';

function collectKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('messages', () => {
  it('has identical keys in every locale', () => {
    const reference = collectKeys(messages.en).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(collectKeys(messages[locale]).sort()).toEqual(reference);
    }
  });

  it('labels every report category and status in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const category of REPORT_CATEGORIES) {
        expect(messages[locale].reportCategory[category]).toBeTruthy();
      }
      for (const status of REPORT_STATUSES) {
        expect(messages[locale].reportStatus[status]).toBeTruthy();
      }
    }
  });
});

describe('translate', () => {
  it('returns the localized string', () => {
    expect(translate('he', 'mobileTabs.report')).toBe('דיווח');
    expect(translate('en', 'reportStatus.in_progress')).toBe('In progress');
  });
});

describe('locales', () => {
  it('resolves device locale tags', () => {
    expect(resolveLocale(['ar-IL', 'en-US'])).toBe('ar');
    expect(resolveLocale(['iw-IL'])).toBe('he');
    expect(resolveLocale(['fr-FR', 'en-GB'])).toBe('en');
    expect(resolveLocale(['fr-FR'])).toBe('he');
    expect(resolveLocale([null, undefined])).toBe('he');
  });

  it('reports text direction', () => {
    expect(getTextDirection('he')).toBe('rtl');
    expect(getTextDirection('ar')).toBe('rtl');
    expect(getTextDirection('en')).toBe('ltr');
  });
});
