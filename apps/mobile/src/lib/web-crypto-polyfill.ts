/**
 * Minimal Web Crypto + TextEncoder polyfill for runtimes without them (Hermes in Expo Go).
 *
 * Supabase Auth builds its PKCE verifier with `crypto.getRandomValues` and its S256 challenge
 * with `crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))`. When any of these
 * is missing it silently uses `Math.random()` and the `plain` method instead. This module fills
 * exactly those gaps and nothing else:
 *
 * - it never replaces an implementation that already exists (browsers keep native Web Crypto);
 * - `subtle.digest` supports SHA-256 only and rejects other algorithms explicitly;
 * - it provides no other `subtle` methods. Supabase's `getClaims()` checks `'subtle' in crypto`
 *   and would then try `importKey`/`verify`, so on mobile use `getUser()` instead.
 *
 * Pure (the crypto backend is passed in) so it can be unit-tested in Node; see web-crypto.ts
 * for the app wiring with expo-crypto.
 */

export interface CryptoBackend {
  /** Fills the array with cryptographically secure random values. */
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  /** SHA-256 of the bytes. */
  sha256(data: Uint8Array): Promise<ArrayBuffer>;
}

/** What the runtime offered before installing, for the development diagnostic. */
export interface WebCryptoReport {
  before: {
    crypto: boolean;
    getRandomValues: boolean;
    subtle: boolean;
    digest: boolean;
    TextEncoder: boolean;
  };
  /** The members this call added, e.g. `['crypto.getRandomValues', 'crypto.subtle.digest']`. */
  installed: string[];
}

type Target = Record<string, unknown>;

function notSupported(message: string): Error {
  return typeof DOMException === 'function'
    ? new DOMException(message, 'NotSupportedError')
    : Object.assign(new Error(message), { name: 'NotSupportedError' });
}

function algorithmName(algorithm: unknown): string {
  const name =
    typeof algorithm === 'string'
      ? algorithm
      : typeof algorithm === 'object' && algorithm !== null && 'name' in algorithm
        ? String((algorithm as { name: unknown }).name)
        : '';
  return name.toUpperCase();
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('digest() data must be an ArrayBuffer or ArrayBufferView');
}

function createDigest(backend: CryptoBackend) {
  return async function digest(algorithm: unknown, data: unknown): Promise<ArrayBuffer> {
    if (algorithmName(algorithm) !== 'SHA-256') {
      throw notSupported(
        `crypto.subtle.digest: only SHA-256 is available in this runtime (got ${String(
          algorithmName(algorithm) || algorithm,
        )})`,
      );
    }
    return backend.sha256(toBytes(data));
  };
}

const INTEGER_ARRAYS = [
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'BigInt64Array',
  'BigUint64Array',
];

function createGetRandomValues(backend: CryptoBackend) {
  return function getRandomValues<T extends ArrayBufferView>(array: T): T {
    const kind = Object.prototype.toString.call(array).slice(8, -1);
    if (!INTEGER_ARRAYS.includes(kind)) {
      throw Object.assign(new TypeError('getRandomValues() requires an integer typed array'), {
        name: 'TypeMismatchError',
      });
    }
    if (array.byteLength > 65536) {
      throw Object.assign(new RangeError('getRandomValues() is limited to 65536 bytes'), {
        name: 'QuotaExceededError',
      });
    }
    return backend.getRandomValues(array);
  };
}

/** Spec-compliant UTF-8 TextEncoder (lone surrogates become U+FFFD), used only when missing. */
export class Utf8TextEncoder {
  readonly encoding = 'utf-8';

  encode(input = ''): Uint8Array {
    const text = String(input);
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          i++;
        } else {
          code = 0xfffd;
        }
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        code = 0xfffd;
      }

      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      }
    }
    return new Uint8Array(bytes);
  }
}

function define(owner: object, key: string, value: unknown) {
  Object.defineProperty(owner, key, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

/**
 * Adds the missing pieces to `target` (normally `globalThis`). Idempotent: a second call
 * installs nothing. Throws if a missing piece cannot be installed, so the app never runs with
 * Supabase's insecure fallbacks.
 */
export function installWebCryptoPolyfill(
  backend: CryptoBackend,
  target: Target = globalThis as unknown as Target,
): WebCryptoReport {
  const existing = target.crypto as
    { getRandomValues?: unknown; subtle?: { digest?: unknown } } | undefined;
  const report: WebCryptoReport = {
    before: {
      crypto: existing !== undefined && existing !== null,
      getRandomValues: typeof existing?.getRandomValues === 'function',
      subtle: existing?.subtle !== undefined && existing?.subtle !== null,
      digest: typeof existing?.subtle?.digest === 'function',
      TextEncoder: typeof target.TextEncoder === 'function',
    },
    installed: [],
  };

  let cryptoObject = existing as Record<string, unknown> | undefined;
  if (!cryptoObject) {
    cryptoObject = {};
    define(target, 'crypto', cryptoObject);
    report.installed.push('crypto');
  }
  if (!report.before.getRandomValues) {
    define(cryptoObject, 'getRandomValues', createGetRandomValues(backend));
    report.installed.push('crypto.getRandomValues');
  }
  let subtle = cryptoObject.subtle as Record<string, unknown> | undefined;
  if (!subtle) {
    subtle = {};
    define(cryptoObject, 'subtle', subtle);
    report.installed.push('crypto.subtle');
  }
  if (!report.before.digest) {
    define(subtle, 'digest', createDigest(backend));
    report.installed.push('crypto.subtle.digest');
  }
  if (!report.before.TextEncoder) {
    define(target, 'TextEncoder', Utf8TextEncoder);
    report.installed.push('TextEncoder');
  }

  assertPkceSupport(target);
  return report;
}

/** Throws unless everything Supabase needs for a secure S256 PKCE flow is present. */
export function assertPkceSupport(target: Target = globalThis as unknown as Target): void {
  const cryptoObject = target.crypto as
    { getRandomValues?: unknown; subtle?: { digest?: unknown } } | undefined;
  const missing = [
    typeof cryptoObject?.getRandomValues !== 'function' && 'crypto.getRandomValues',
    typeof cryptoObject?.subtle?.digest !== 'function' && 'crypto.subtle.digest',
    typeof target.TextEncoder !== 'function' && 'TextEncoder',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Secure PKCE is unavailable (missing ${missing.join(', ')}). Refusing to continue ` +
        'with Supabase’s Math.random()/plain fallback.',
    );
  }
}

/** FIPS 180-2 test vector: SHA-256("abc"). */
export const SHA256_ABC_HEX = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Runtime self-check of the installed primitives (used by the development diagnostic). */
export async function verifyWebCrypto(
  target: Target = globalThis as unknown as Target,
): Promise<{ sha256: boolean; randomValues: boolean }> {
  const cryptoObject = target.crypto as {
    getRandomValues(array: Uint8Array): Uint8Array;
    subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
  };
  const Encoder = target.TextEncoder as typeof Utf8TextEncoder;
  const hash = await cryptoObject.subtle.digest('SHA-256', new Encoder().encode('abc'));
  const random = cryptoObject.getRandomValues(new Uint8Array(32));
  return {
    sha256: toHex(hash) === SHA256_ABC_HEX,
    randomValues: random.some((byte) => byte !== 0),
  };
}
