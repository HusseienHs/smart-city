import { describe, expect, it } from 'vitest';

import { base64ByteLength, base64ToBytes } from './base64';

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

describe('base64', () => {
  it('decodes exactly what the platform encoder produced, for every padding length', () => {
    for (let length = 0; length <= 40; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + length) & 0xff);
      expect(base64ToBytes(encode(bytes))).toEqual(bytes);
      expect(base64ByteLength(encode(bytes))).toBe(length);
    }
  });

  it('decodes a JPEG header and tolerates line breaks and data-URI prefixes', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const text = encode(jpeg);
    expect(base64ToBytes(`data:image/jpeg;base64,${text}`)).toEqual(jpeg);
    expect(base64ToBytes(`${text.slice(0, 4)}\n${text.slice(4)}`)).toEqual(jpeg);
  });

  it('rejects invalid input', () => {
    expect(() => base64ToBytes('ab$d')).toThrow();
    expect(() => base64ToBytes('abcde')).toThrow();
  });
});
