import { describe, expect, it } from 'vitest';

import { proxyDecision, routeArea, safeNextPath, signInHref } from './routes';

describe('route areas', () => {
  it('classifies public, session and dashboard pages', () => {
    expect(routeArea('/sign-in')).toBe('public');
    expect(routeArea('/forgot-password')).toBe('public');
    expect(routeArea('/reset-password')).toBe('public');
    expect(routeArea('/auth/callback')).toBe('public');
    expect(routeArea('/access')).toBe('session');
    // Staff registration is reachable signed out; it grants nothing by itself.
    expect(routeArea('/join')).toBe('public');
    expect(routeArea('/joined')).toBe('dashboard');
    expect(routeArea('/')).toBe('dashboard');
    expect(routeArea('/reports')).toBe('dashboard');
    expect(routeArea('/settings')).toBe('dashboard');
    // Prefixes must match whole segments.
    expect(routeArea('/sign-in-elsewhere')).toBe('dashboard');
    expect(routeArea('/accessories')).toBe('dashboard');
  });
});

describe('safe redirect after sign-in (no open redirects)', () => {
  it('keeps same-site dashboard paths with their query', () => {
    expect(safeNextPath('/he/reports', 'he')).toBe('/he/reports');
    expect(safeNextPath('/en/reports?status=open', 'he')).toBe('/en/reports?status=open');
    expect(safeNextPath('/ar/access', 'ar')).toBe('/ar/access');
  });

  it('rejects other origins, protocol tricks and malformed values', () => {
    for (const next of [
      'https://evil.example/he',
      '//evil.example/he',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      ' /he/reports',
      '/he/reports\n',
      'he/reports',
      '',
      null,
      undefined,
    ]) {
      expect(safeNextPath(next, 'he')).toBe('/he');
    }
  });

  it('rejects paths without a locale, and the auth pages themselves (no loops)', () => {
    expect(safeNextPath('/reports', 'ar')).toBe('/ar');
    expect(safeNextPath('/fr/reports', 'en')).toBe('/en');
    expect(safeNextPath('/he/sign-in?next=/he', 'he')).toBe('/he');
    expect(safeNextPath('/he/auth/callback?code=x', 'he')).toBe('/he');
    expect(safeNextPath('/he/forgot-password', 'he')).toBe('/he');
  });

  it('accepts the password-reset page, where reset links lead', () => {
    expect(safeNextPath('/he/reset-password', 'he')).toBe('/he/reset-password');
  });
});

describe('proxy decision (optimistic, before rendering)', () => {
  it('sends signed-out visitors of dashboard pages to sign-in, remembering the page', () => {
    expect(proxyDecision('/he/reports', '?status=open', false)).toEqual({
      type: 'redirect',
      to: signInHref('he', '/he/reports?status=open'),
    });
    expect(proxyDecision('/ar', '', false)).toEqual({
      type: 'redirect',
      to: '/ar/sign-in?next=%2Far',
    });
  });

  it('an expired session (no verified user) is treated as signed out', () => {
    expect(proxyDecision('/en/settings', '', false).type).toBe('redirect');
    expect(proxyDecision('/en/access', '', false).type).toBe('redirect');
  });

  it('lets anyone reach the public auth pages', () => {
    for (const path of [
      '/he/sign-in',
      '/he/forgot-password',
      '/he/reset-password',
      '/he/auth/callback',
    ]) {
      expect(proxyDecision(path, '', false)).toEqual({ type: 'continue' });
    }
  });

  it('signed-in users skip the sign-in page, to a safe destination only', () => {
    expect(proxyDecision('/he/sign-in', '', true)).toEqual({ type: 'redirect', to: '/he' });
    expect(proxyDecision('/he/sign-in', '?next=%2Fhe%2Freports', true)).toEqual({
      type: 'redirect',
      to: '/he/reports',
    });
    expect(proxyDecision('/he/sign-in', '?next=https%3A%2F%2Fevil.example', true)).toEqual({
      type: 'redirect',
      to: '/he',
    });
  });

  it('signed-in users continue to every other page (roles are checked by the pages)', () => {
    expect(proxyDecision('/he/settings', '', true)).toEqual({ type: 'continue' });
    expect(proxyDecision('/he/access', '', true)).toEqual({ type: 'continue' });
  });
});

describe('sign-in links', () => {
  it('encode the return path and notice', () => {
    expect(signInHref('he')).toBe('/he/sign-in');
    expect(signInHref('en', '/en/reports?x=1', 'session')).toBe(
      '/en/sign-in?next=%2Fen%2Freports%3Fx%3D1&notice=session',
    );
  });
});

describe('staff registration links', () => {
  it('never returns to the registration page after signing in', () => {
    expect(safeNextPath('/he/join', 'he')).toBe('/he');
    expect(safeNextPath('/he/access', 'he')).toBe('/he/access');
  });
});
