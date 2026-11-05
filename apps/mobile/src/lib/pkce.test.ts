/**
 * End-to-end PKCE check with the real supabase-js: the request it sends and the verifier it
 * stores. The network is a fake fetch; the runtime is made to look like Hermes in Expo Go
 * (no global crypto, no TextEncoder) by removing Node's built-ins for the duration of a test.
 */
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  platformBackend,
  PlatformTextEncoder,
  sha256,
  toBase64Url,
} from './test-support/platform-crypto';
import { installWebCryptoPolyfill } from './web-crypto-polyfill';

const WEBCRYPTO_WARNING = 'WebCrypto API is not supported';

/** The S256 challenge RFC 7636 defines: BASE64URL(SHA-256(ASCII(verifier))). */
async function expectedChallenge(verifier: string): Promise<string> {
  return toBase64Url(await sha256(new PlatformTextEncoder().encode(verifier)));
}

const GLOBALS = ['crypto', 'TextEncoder'] as const;
let saved: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  saved = new Map(GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
});

afterEach(() => {
  for (const name of GLOBALS) {
    delete (globalThis as Record<string, unknown>)[name];
    const descriptor = saved.get(name);
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  }
  vi.restoreAllMocks();
});

/** Removes the globals Hermes lacks. */
function simulateHermes() {
  for (const name of GLOBALS) delete (globalThis as Record<string, unknown>)[name];
  expect(typeof (globalThis as Record<string, unknown>).crypto).toBe('undefined');
  expect(typeof (globalThis as Record<string, unknown>).TextEncoder).toBe('undefined');
}

function setup() {
  const store = new Map<string, string>();
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const supabase = createClient('https://project-ref.supabase.co', 'sb_publishable_test', {
    auth: {
      flowType: 'pkce',
      storage: {
        getItem: async (key) => store.get(key) ?? null,
        setItem: async (key, value) => void store.set(key, value),
        removeItem: async (key) => void store.delete(key),
      },
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        requests.push({ url: String(input), body });
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    },
  });

  /**
   * The verifier of the latest flow. supabase-js keeps one slot per flow
   * (`…-flow-<id>-code-verifier`) and mirrors the latest under this fixed key. Recovery flows
   * append "/recovery".
   */
  const storedVerifier = () => {
    const value = store.get('sb-project-ref-auth-token-code-verifier');
    if (!value) throw new Error('no code verifier stored');
    return (JSON.parse(value) as string).split('/')[0]!;
  };
  /** The body of the request to an auth endpoint (query strings like ?redirect_to are ignored). */
  const requestTo = (path: string) => {
    const request = requests.find((r) => new URL(r.url).pathname === `/auth/v1${path}`);
    if (!request) throw new Error(`no request to ${path}`);
    return request.body;
  };
  return { supabase, storedVerifier, requestTo };
}

describe('root cause (no polyfill)', () => {
  it('without global crypto, Supabase falls back to Math.random() and the plain method', async () => {
    // Only crypto is removed: without TextEncoder supabase-js fails earlier with a
    // ReferenceError, before PKCE runs (Expo's fetch also relies on a native TextEncoder).
    delete (globalThis as Record<string, unknown>).crypto;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { supabase, storedVerifier, requestTo } = setup();

    await supabase.auth.resetPasswordForEmail('dana@example.com', {
      redirectTo: 'exp://192.168.1.104:8081/--/auth/callback',
    });

    const body = requestTo('/recover');
    expect(body.code_challenge_method).toBe('plain');
    expect(body.code_challenge).toBe(storedVerifier());
    // 56 characters from Supabase's Math.random() charset, not 112 hex characters.
    expect(storedVerifier()).toMatch(/^[A-Za-z0-9._~-]{56}$/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(WEBCRYPTO_WARNING));
  });
});

describe('with the polyfill on a Hermes-like runtime', () => {
  beforeEach(() => {
    simulateHermes();
    const report = installWebCryptoPolyfill(platformBackend());
    expect(report.installed).toContain('crypto.subtle.digest');
    expect(report.installed).toContain('TextEncoder');
  });

  it('password recovery sends an S256 challenge equal to SHA-256 of the stored verifier', async () => {
    const warn = vi.spyOn(console, 'warn');
    const { supabase, storedVerifier, requestTo } = setup();

    await supabase.auth.resetPasswordForEmail('dana@example.com', {
      redirectTo: 'exp://192.168.1.104:8081/--/auth/callback',
    });

    const body = requestTo('/recover');
    const verifier = storedVerifier();
    expect(body.code_challenge_method).toBe('s256');
    // 56 random 32-bit words as hex: the secure getRandomValues path.
    expect(verifier).toMatch(/^[0-9a-f]{112}$/);
    expect(body.code_challenge).toBe(await expectedChallenge(verifier));
    expect(body.code_challenge).not.toBe(verifier);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(WEBCRYPTO_WARNING));
  });

  it('sign-up sends an S256 challenge equal to SHA-256 of the stored verifier', async () => {
    const { supabase, storedVerifier, requestTo } = setup();

    await supabase.auth.signUp({
      email: 'dana@example.com',
      password: 'correct-horse',
      options: { emailRedirectTo: 'exp://192.168.1.104:8081/--/auth/callback' },
    });

    const body = requestTo('/signup');
    const verifier = storedVerifier();
    expect(body.code_challenge_method).toBe('s256');
    expect(verifier).toMatch(/^[0-9a-f]{112}$/);
    expect(body.code_challenge).toBe(await expectedChallenge(verifier));
  });

  it('generates a different verifier for every flow', async () => {
    const { supabase, storedVerifier } = setup();
    await supabase.auth.resetPasswordForEmail('a@example.com');
    const first = storedVerifier();
    await supabase.auth.resetPasswordForEmail('a@example.com');
    expect(storedVerifier()).not.toBe(first);
  });
});
