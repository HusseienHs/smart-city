import { messages } from '@smart-city/shared/i18n';
import { describe, expect, it } from 'vitest';

import {
  checkAuthRedirect,
  devRedirectError,
  devRedirectNoticeKey,
  isDevelopmentEnv,
  type AppRuntime,
  type AuthRedirectInfo,
} from './auth-redirect';

const ok = (url: string, runtime: AppRuntime, localOnly = false): AuthRedirectInfo => ({
  url,
  runtime,
  localOnly,
  problem: null,
});

describe('checkAuthRedirect: valid redirects', () => {
  it.each([
    ['exp://192.168.1.5:8081/--/auth/callback', 'expo-go'],
    ['exp://10.0.0.12:8082/--/auth/callback', 'expo-go'],
    ['exps://abc-anonymous-8081.exp.direct/--/auth/callback', 'expo-go'],
    ['smartcity://auth/callback', 'native-build'],
    ['smartcity:///auth/callback', 'native-build'],
    ['https://app.smartcity.example/auth/callback', 'web'],
    ['http://192.168.1.5:8081/auth/callback', 'web'],
  ] as const)('%s is valid for %s', (url, runtime) => {
    expect(checkAuthRedirect(url, runtime)).toEqual(ok(url, runtime));
  });

  it('flags localhost as reachable from this computer only (still a valid redirect)', () => {
    for (const url of [
      'http://localhost:8081/auth/callback',
      'http://127.0.0.1:8082/auth/callback',
      'http://[::1]:8081/auth/callback',
    ]) {
      expect(checkAuthRedirect(url, 'web')).toEqual(ok(url, 'web', true));
    }
    const simulator = 'exp://localhost:8081/--/auth/callback';
    expect(checkAuthRedirect(simulator, 'expo-go')).toEqual(ok(simulator, 'expo-go', true));
  });

  it('tolerates a trailing slash and a query string', () => {
    expect(checkAuthRedirect('exp://10.0.0.5:8081/--/auth/callback/?x=1', 'expo-go').problem).toBe(
      null,
    );
    expect(checkAuthRedirect('smartcity://auth/callback?x=1', 'native-build').problem).toBe(null);
  });
});

describe('checkAuthRedirect: invalid configurations', () => {
  it.each([
    // The reported iPhone problem: a web link on a phone.
    ['http://localhost:8081/auth/callback', 'expo-go', 'wrong-scheme'],
    ['http://localhost:8081/auth/callback', 'native-build', 'wrong-scheme'],
    // A build can't receive Expo Go links, and Expo Go can't receive the app scheme.
    ['exp://192.168.1.5:8081/--/auth/callback', 'native-build', 'wrong-scheme'],
    ['smartcity://auth/callback', 'expo-go', 'wrong-scheme'],
    // A browser can't open app schemes.
    ['smartcity://auth/callback', 'web', 'wrong-scheme'],
    ['exp://192.168.1.5:8081/--/auth/callback', 'web', 'wrong-scheme'],
    ['otherapp://auth/callback', 'native-build', 'wrong-scheme'],
    // Wrong or missing route.
    ['exp://192.168.1.5:8081/auth/callback', 'expo-go', 'wrong-path'],
    ['exp://192.168.1.5:8081/--/', 'expo-go', 'wrong-path'],
    ['smartcity://callback', 'native-build', 'wrong-path'],
    ['smartcity://', 'native-build', 'wrong-path'],
    ['http://localhost:8081/', 'web', 'wrong-path'],
    ['http://localhost:8081/--/auth/callback', 'web', 'wrong-path'],
    // No development server host.
    ['exp:///--/auth/callback', 'expo-go', 'missing-host'],
    ['http:///auth/callback', 'web', 'missing-host'],
    // Not a URL.
    ['', 'web', 'empty'],
    ['   ', 'expo-go', 'empty'],
    ['auth/callback', 'native-build', 'unparseable'],
    ['localhost:8081/auth/callback', 'web', 'unparseable'],
  ] as const)('%s on %s → %s', (url, runtime, problem) => {
    expect(checkAuthRedirect(url, runtime).problem).toBe(problem);
  });
});

describe('development-only enforcement', () => {
  const bad = checkAuthRedirect('http://localhost:8081/auth/callback', 'expo-go');
  const good = checkAuthRedirect('exp://192.168.1.5:8081/--/auth/callback', 'expo-go');

  it('blocks a bad redirect only in development', () => {
    expect(devRedirectError(bad, 'development')).toBe('auth.errors.redirectInvalid');
    for (const env of ['production', 'test', undefined, 'Development']) {
      expect(devRedirectError(bad, env)).toBeNull();
    }
    expect(devRedirectError(good, 'development')).toBeNull();
    expect(isDevelopmentEnv('development')).toBe(true);
    expect(isDevelopmentEnv('production')).toBe(false);
  });
});

describe('devRedirectNoticeKey', () => {
  it.each([
    ['exp://192.168.1.5:8081/--/auth/callback', 'expo-go', 'auth.devLink.expoGo'],
    ['exp://localhost:8081/--/auth/callback', 'expo-go', 'auth.devLink.expoGoLocal'],
    ['smartcity://auth/callback', 'native-build', 'auth.devLink.nativeBuild'],
    ['https://app.smartcity.example/auth/callback', 'web', 'auth.devLink.web'],
    ['http://localhost:8081/auth/callback', 'web', 'auth.devLink.webLocal'],
    ['http://localhost:8081/auth/callback', 'expo-go', 'auth.devLink.invalid'],
  ] as const)('%s on %s → %s', (url, runtime, key) => {
    expect(devRedirectNoticeKey(checkAuthRedirect(url, runtime))).toBe(key);
  });

  it('every notice and error key exists in the translations and shows the URL', () => {
    const keys = [
      'auth.devLink.invalid',
      'auth.devLink.expoGo',
      'auth.devLink.expoGoLocal',
      'auth.devLink.nativeBuild',
      'auth.devLink.web',
      'auth.devLink.webLocal',
    ];
    for (const locale of ['en', 'he', 'ar'] as const) {
      for (const key of keys) {
        const value = key
          .split('.')
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            messages[locale],
          );
        expect(value).toContain('{url}');
      }
      expect(typeof messages[locale].auth.errors.redirectInvalid).toBe('string');
    }
  });
});
