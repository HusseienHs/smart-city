import { describe, expect, it } from 'vitest';

import {
  localeFromPathname,
  localeRedirect,
  localizedHref,
  parseAcceptLanguage,
  preferredLocale,
  stripLocale,
  switchLocalePath,
} from './routing';

describe('locale prefixes', () => {
  it('reads the locale from the first path segment only', () => {
    expect(localeFromPathname('/he')).toBe('he');
    expect(localeFromPathname('/ar/reports')).toBe('ar');
    expect(localeFromPathname('/en/reports/123')).toBe('en');
    expect(localeFromPathname('/')).toBeNull();
    expect(localeFromPathname('/reports')).toBeNull();
    expect(localeFromPathname('/fr/reports')).toBeNull();
    expect(localeFromPathname('/hebrew')).toBeNull();
    expect(localeFromPathname('/reports/he')).toBeNull();
  });

  it('strips the prefix, keeping the rest of the path', () => {
    expect(stripLocale('/he')).toBe('/');
    expect(stripLocale('/he/')).toBe('/');
    expect(stripLocale('/ar/reports')).toBe('/reports');
    expect(stripLocale('/en/reports/123')).toBe('/reports/123');
    expect(stripLocale('/reports')).toBe('/reports');
    expect(stripLocale('')).toBe('/');
  });

  it('builds localized links', () => {
    expect(localizedHref('he', '/')).toBe('/he');
    expect(localizedHref('ar', '/reports')).toBe('/ar/reports');
    expect(localizedHref('en', 'audit-log')).toBe('/en/audit-log');
  });

  it('switches language on the same page', () => {
    expect(switchLocalePath('/he/reports', 'en')).toBe('/en/reports');
    expect(switchLocalePath('/en', 'ar')).toBe('/ar');
    expect(switchLocalePath('/ar/employees/5', 'he')).toBe('/he/employees/5');
  });
});

describe('preferred locale', () => {
  it('orders Accept-Language by quality, then by position', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9,ar;q=0.95')).toEqual(['en-US', 'ar', 'en']);
    expect(parseAcceptLanguage('fr;q=0, he-IL')).toEqual(['he-IL']);
    expect(parseAcceptLanguage('*')).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });

  it('uses the saved choice, then the browser, then Hebrew', () => {
    expect(preferredLocale({ cookie: 'ar', acceptLanguage: 'en-US' })).toBe('ar');
    expect(preferredLocale({ cookie: 'xx', acceptLanguage: 'en-US,he;q=0.5' })).toBe('en');
    expect(preferredLocale({ acceptLanguage: 'fr-FR,ar-IL;q=0.8' })).toBe('ar');
    expect(preferredLocale({ acceptLanguage: 'iw' })).toBe('he');
    expect(preferredLocale({ acceptLanguage: 'fr-FR' })).toBe('he');
    expect(preferredLocale({})).toBe('he');
  });
});

describe('locale redirect', () => {
  it('prefixes paths without a locale', () => {
    expect(localeRedirect('/', {})).toBe('/he');
    expect(localeRedirect('/reports', { cookie: 'en' })).toBe('/en/reports');
    expect(localeRedirect('/reports/123', { acceptLanguage: 'ar' })).toBe('/ar/reports/123');
  });

  it('treats an unknown first segment as a page, so it 404s in the preferred locale', () => {
    expect(localeRedirect('/fr/reports', {})).toBe('/he/fr/reports');
  });

  it('leaves localized paths alone, even if the saved choice differs', () => {
    expect(localeRedirect('/he', { cookie: 'en' })).toBeNull();
    expect(localeRedirect('/ar/reports', { cookie: 'en' })).toBeNull();
  });
});
