import { describe, expect, it } from 'vitest';

/**
 * React Compiler (enabled in app.json) memoizes callbacks and JSX on the values they read, and
 * compares those values on every render — outside any `x ? … : …` guard written around them.
 * A non-null assertion followed by a property read (`report!.id`) is erased by TypeScript, so the
 * compiled component reads `.id` of null and crashes during render. This is what broke Home
 * ("Cannot read properties of null (reading 'id')").
 *
 * Screens and components must narrow first (`const id = report?.id`) instead.
 */

// Vite/Vitest's static glob import (types declared here: the app's tsconfig has no Vite types).
declare global {
  interface ImportMeta {
    glob(
      pattern: string | string[],
      options: { query: '?raw'; import: 'default'; eager: true },
    ): Record<string, string>;
  }
}

const SOURCES = import.meta.glob(['../app/**/*.{ts,tsx}', '../components/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const ASSERTED_MEMBER = /[\w\])]!\.[A-Za-z_$]/;

describe('React Compiler safety', () => {
  it('reads the screen and component sources', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    expect(Object.keys(SOURCES)).toContain('../app/(tabs)/index.tsx');
  });

  it('screens and components never read a property through a non-null assertion', () => {
    const offenders = Object.entries(SOURCES).flatMap(([path, source]) =>
      source
        .split('\n')
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*'))
        .filter(({ line }) => ASSERTED_MEMBER.test(line))
        .map(({ line, number }) => `${path}:${number}: ${line}`),
    );
    expect(offenders).toEqual([]);
  });

  it('detects the pattern that crashed Home', () => {
    expect(ASSERTED_MEMBER.test('getMyReportUpdates(c, { reportId: tracked!.id })')).toBe(true);
    expect(ASSERTED_MEMBER.test('const id = tracked?.id ?? null;')).toBe(false);
    expect(ASSERTED_MEMBER.test('if (a !== b.id) return;')).toBe(false);
  });
});
