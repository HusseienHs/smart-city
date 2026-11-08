import { beforeEach, describe, expect, it, vi } from 'vitest';

const expoCrypto = vi.hoisted(() => ({
  getRandomValues: vi.fn((array: Uint8Array) => array.fill(7)),
  digest: vi.fn(async () => new ArrayBuffer(32)),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomValues: expoCrypto.getRandomValues,
  digest: expoCrypto.digest,
}));

const { expoCryptoBackend } = await import('./web-crypto');

beforeEach(() => vi.clearAllMocks());

describe('expo-crypto backend', () => {
  it('hashes with expo-crypto SHA-256', async () => {
    const data = new Uint8Array([1, 2, 3]);
    await expoCryptoBackend.sha256(data);
    expect(expoCrypto.digest).toHaveBeenCalledWith('SHA-256', data);
  });

  it('takes random values from expo-crypto', () => {
    const array = new Uint8Array(4);
    expect(expoCryptoBackend.getRandomValues(array)).toEqual(new Uint8Array([7, 7, 7, 7]));
    expect(expoCrypto.getRandomValues).toHaveBeenCalledWith(array);
  });
});
