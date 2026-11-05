/**
 * Base64 helpers for photo data (the image manipulator returns the prepared JPEG as Base64).
 * Hand-written so they work the same on Hermes, the web and Node, without extra dependencies.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...ALPHABET].map((char, index) => [char, index]));

function clean(base64: string): string {
  // Tolerates line breaks and a data-URI prefix; '-'/'_' (URL-safe alphabet) are normalized.
  const body = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  return body.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
}

/** Number of bytes the Base64 text encodes. */
export function base64ByteLength(base64: string): number {
  return Math.floor((clean(base64).length * 3) / 4);
}

/** Decodes Base64 into bytes. Throws on characters outside the alphabet. */
export function base64ToBytes(base64: string): Uint8Array {
  const text = clean(base64);
  if (text.length % 4 === 1) throw new Error('Invalid Base64 length');
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let byteIndex = 0;
  for (let i = 0; i < text.length; i += 4) {
    const values = [0, 1, 2, 3].map((offset) => {
      const char = text[i + offset];
      if (char === undefined) return 0;
      const value = LOOKUP.get(char);
      if (value === undefined) throw new Error('Invalid Base64 character');
      return value;
    });
    const chunk = (values[0]! << 18) | (values[1]! << 12) | (values[2]! << 6) | values[3]!;
    const available = Math.min(3, text.length - i - 1);
    for (let shift = 0; shift < available; shift += 1) {
      bytes[byteIndex++] = (chunk >> (16 - 8 * shift)) & 0xff;
    }
  }
  return bytes;
}
