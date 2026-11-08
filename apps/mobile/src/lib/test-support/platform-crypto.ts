/**
 * Test-only: the test runner's own Web Crypto and TextEncoder, captured when this module loads,
 * before any test removes the globals to imitate Hermes. Stands in for expo-crypto.
 */
import type { CryptoBackend } from '../web-crypto-polyfill';

const platformCrypto = globalThis.crypto;
export const PlatformTextEncoder = globalThis.TextEncoder;

export function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  return platformCrypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>);
}

export function platformBackend(): CryptoBackend {
  return {
    getRandomValues: (array) =>
      platformCrypto.getRandomValues(
        array as unknown as Uint8Array<ArrayBuffer>,
      ) as unknown as typeof array,
    sha256,
  };
}

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
