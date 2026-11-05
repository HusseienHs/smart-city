import { describe, expect, it, vi } from 'vitest';

import { platformBackend, PlatformTextEncoder, toHex as hex } from './test-support/platform-crypto';
import {
  assertPkceSupport,
  installWebCryptoPolyfill,
  SHA256_ABC_HEX,
  Utf8TextEncoder,
  verifyWebCrypto,
} from './web-crypto-polyfill';

/** Stands in for expo-crypto, with a spy on hashing. */
function nodeBackend() {
  const backend = platformBackend();
  return { ...backend, sha256: vi.fn(backend.sha256) };
}

type Crypto = {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: { digest(algorithm: unknown, data: unknown): Promise<ArrayBuffer> };
};

describe('installWebCryptoPolyfill on a Hermes-like runtime (no crypto, no TextEncoder)', () => {
  it('installs exactly the missing pieces and reports what was there', () => {
    const target: Record<string, unknown> = {};
    const report = installWebCryptoPolyfill(nodeBackend(), target);

    expect(report.before).toEqual({
      crypto: false,
      getRandomValues: false,
      subtle: false,
      digest: false,
      TextEncoder: false,
    });
    expect(report.installed).toEqual([
      'crypto',
      'crypto.getRandomValues',
      'crypto.subtle',
      'crypto.subtle.digest',
      'TextEncoder',
    ]);
    expect(() => assertPkceSupport(target)).not.toThrow();
  });

  it('computes SHA-256 (FIPS 180-2 vector) for string and object algorithm names', async () => {
    const target: Record<string, unknown> = {};
    installWebCryptoPolyfill(nodeBackend(), target);
    const crypto = target.crypto as Crypto;
    const abc = new Utf8TextEncoder().encode('abc');

    expect(hex(await crypto.subtle.digest('SHA-256', abc))).toBe(SHA256_ABC_HEX);
    expect(hex(await crypto.subtle.digest({ name: 'sha-256' }, abc.buffer))).toBe(SHA256_ABC_HEX);
    expect(await verifyWebCrypto(target)).toEqual({ sha256: true, randomValues: true });
  });

  it('rejects unsupported digest algorithms explicitly, without hashing', async () => {
    const backend = nodeBackend();
    const target: Record<string, unknown> = {};
    installWebCryptoPolyfill(backend, target);
    const { subtle } = target.crypto as Crypto;
    const data = new Uint8Array([1, 2, 3]);

    for (const algorithm of ['SHA-1', 'SHA-384', 'SHA-512', { name: 'MD5' }, '']) {
      await expect(subtle.digest(algorithm, data)).rejects.toMatchObject({
        name: 'NotSupportedError',
      });
    }
    expect(backend.sha256).not.toHaveBeenCalled();
  });

  it('rejects non-buffer digest input', async () => {
    const target: Record<string, unknown> = {};
    installWebCryptoPolyfill(nodeBackend(), target);
    const { subtle } = target.crypto as Crypto;
    await expect(subtle.digest('SHA-256', 'abc')).rejects.toBeInstanceOf(TypeError);
  });

  it('fills integer arrays with random values and enforces the Web Crypto limits', () => {
    const target: Record<string, unknown> = {};
    installWebCryptoPolyfill(nodeBackend(), target);
    const crypto = target.crypto as Crypto;

    const a = crypto.getRandomValues(new Uint32Array(56));
    const b = crypto.getRandomValues(new Uint32Array(56));
    expect(a).not.toEqual(b);
    expect(() => crypto.getRandomValues(new Float32Array(4))).toThrow(TypeError);
    expect(() => crypto.getRandomValues(new Uint8Array(65537))).toThrow(RangeError);
  });

  it('is idempotent', () => {
    const target: Record<string, unknown> = {};
    installWebCryptoPolyfill(nodeBackend(), target);
    expect(installWebCryptoPolyfill(nodeBackend(), target).installed).toEqual([]);
  });
});

describe('never overriding an existing implementation', () => {
  it('leaves a complete native/browser implementation untouched', () => {
    const native = {
      getRandomValues: () => new Uint8Array(),
      subtle: { digest: async () => new ArrayBuffer(32) },
    };
    const target: Record<string, unknown> = { crypto: native, TextEncoder: PlatformTextEncoder };
    const report = installWebCryptoPolyfill(nodeBackend(), target);

    expect(report.installed).toEqual([]);
    expect(target.crypto).toBe(native);
    expect((target.crypto as typeof native).getRandomValues).toBe(native.getRandomValues);
    expect((target.crypto as typeof native).subtle.digest).toBe(native.subtle.digest);
    expect(target.TextEncoder).toBe(PlatformTextEncoder);
  });

  it('keeps an existing getRandomValues and only adds subtle.digest', () => {
    const getRandomValues = vi.fn();
    const native = { getRandomValues };
    const target: Record<string, unknown> = { crypto: native, TextEncoder: PlatformTextEncoder };
    const report = installWebCryptoPolyfill(nodeBackend(), target);

    expect(report.installed).toEqual(['crypto.subtle', 'crypto.subtle.digest']);
    expect(target.crypto).toBe(native);
    expect((target.crypto as Crypto).getRandomValues).toBe(getRandomValues);
  });
});

describe('explicit failure instead of insecure fallback', () => {
  it('throws when the missing pieces cannot be installed', () => {
    const frozen = Object.freeze({});
    expect(() => installWebCryptoPolyfill(nodeBackend(), { crypto: frozen })).toThrow();
  });

  it('assertPkceSupport names what is missing', () => {
    expect(() => assertPkceSupport({})).toThrow(
      /crypto\.getRandomValues, crypto\.subtle\.digest, TextEncoder/,
    );
  });
});

describe('Utf8TextEncoder', () => {
  const samples = [
    '',
    'abc',
    'pkce-verifier-0123456789abcdef',
    'שלום עולם',
    'مرحبا بالعالم',
    'ünïcödé – €',
    '😀 emoji 🇮🇱',
    'lone high \uD83D end',
    'lone low \uDE00 end',
    '􏿿 max code point',
  ];

  it('matches the platform TextEncoder byte for byte', () => {
    const native = new PlatformTextEncoder();
    const polyfill = new Utf8TextEncoder();
    for (const text of samples) {
      expect(polyfill.encode(text)).toEqual(native.encode(text));
    }
    expect(polyfill.encoding).toBe('utf-8');
    expect(polyfill.encode()).toEqual(new Uint8Array());
  });
});
