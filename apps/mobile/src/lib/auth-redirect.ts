/**
 * Checks the email-link redirect (`emailRedirectTo` / `redirectTo`) against where the app runs.
 * Pure (no React Native imports) so every case can be unit-tested.
 *
 * Why: a link only finishes sign-in if it opens the same app on the same device that asked for
 * it (the PKCE code verifier is stored there). A wrong redirect fails silently for the citizen,
 * e.g. an email requested from the web app points at http://localhost:8081, which on a phone
 * means the phone itself. In development these checks stop such an email from being sent and
 * explain where the link will open. Production behavior is unchanged.
 */
import type { MessageKey } from '@smart-city/shared/i18n';

import { AUTH_CALLBACK_PATH } from './auth-utils';

/** The app's custom URL scheme (app.json `expo.scheme`). */
export const APP_SCHEME = 'smartcity';

/** Where the app is running: Expo Go, a native build (development or store), or a browser. */
export type AppRuntime = 'expo-go' | 'native-build' | 'web';

export type AuthRedirectProblem =
  /** No URL at all (e.g. web static rendering). */
  | 'empty'
  /** Not a `scheme://…` URL. */
  | 'unparseable'
  /** A scheme this runtime can't receive (e.g. http on a phone, exp:// in a build). */
  | 'wrong-scheme'
  /** Expo Go and the web need the development server's host. */
  | 'missing-host'
  /** Doesn't lead to the auth/callback screen. */
  | 'wrong-path';

export interface AuthRedirectInfo {
  url: string;
  runtime: AppRuntime;
  /** The host is this computer (localhost): unreachable from a phone. */
  localOnly: boolean;
  problem: AuthRedirectProblem | null;
}

const EXPECTED_SCHEMES: Readonly<Record<AppRuntime, readonly string[]>> = {
  'expo-go': ['exp', 'exps'],
  'native-build': [APP_SCHEME],
  web: ['http', 'https'],
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function hostOf(authority: string): string {
  const withoutUser = authority.slice(authority.lastIndexOf('@') + 1);
  if (withoutUser.startsWith('[')) return withoutUser.slice(0, withoutUser.indexOf(']') + 1);
  return withoutUser.replace(/:\d*$/, '').toLowerCase();
}

const trimSlashes = (path: string) => path.replace(/^\/+/, '').replace(/\/+$/, '');

/** Checks one redirect URL for one runtime. */
export function checkAuthRedirect(
  url: string,
  runtime: AppRuntime,
  callbackPath: string = AUTH_CALLBACK_PATH,
): AuthRedirectInfo {
  const result = (problem: AuthRedirectProblem | null, localOnly = false): AuthRedirectInfo => ({
    url,
    runtime,
    localOnly,
    problem,
  });
  if (!url.trim()) return result('empty');

  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(url.trim());
  if (!match) return result('unparseable');
  const scheme = match[1]!.toLowerCase();
  const authority = match[2]!;
  const path = match[3]!;
  if (!EXPECTED_SCHEMES[runtime].includes(scheme)) return result('wrong-scheme');

  const callback = trimSlashes(callbackPath);
  if (runtime === 'native-build') {
    // `smartcity://auth/callback`: the first path segment is parsed as the "host".
    return result(trimSlashes(`${authority}${path}`) === callback ? null : 'wrong-path');
  }

  const host = hostOf(authority);
  if (!host) return result('missing-host');
  const localOnly = LOCAL_HOSTS.has(host);
  // Expo Go addresses app routes after `/--/` (exp://192.168.1.5:8081/--/auth/callback).
  const expected = runtime === 'expo-go' ? `--/${callback}` : callback;
  return result(trimSlashes(path) === expected ? null : 'wrong-path', localOnly);
}

/** Whether redirect diagnostics run: development builds only (NODE_ENV is inlined at build). */
export function isDevelopmentEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}

/**
 * In development, the error that stops an email whose link could not open this app; null when
 * the redirect is fine, or outside development (production behavior is unchanged).
 */
export function devRedirectError(
  info: AuthRedirectInfo,
  nodeEnv: string | undefined,
): MessageKey | null {
  if (!isDevelopmentEnv(nodeEnv) || info.problem === null) return null;
  return 'auth.errors.redirectInvalid';
}

/** The development notice explaining where the verification link will open. */
export function devRedirectNoticeKey(info: AuthRedirectInfo): MessageKey {
  if (info.problem) return 'auth.devLink.invalid';
  switch (info.runtime) {
    case 'expo-go':
      return info.localOnly ? 'auth.devLink.expoGoLocal' : 'auth.devLink.expoGo';
    case 'native-build':
      return 'auth.devLink.nativeBuild';
    case 'web':
      return info.localOnly ? 'auth.devLink.webLocal' : 'auth.devLink.web';
  }
}
