import { describe, expect, it } from 'vitest';

import { appColorSchemes, type AppColors } from './colors';

/** WCAG 2.x relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a #RRGGBB color: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Foreground / background pairs used for text, with the WCAG AA minimum for normal text. */
const TEXT_PAIRS: readonly [keyof AppColors, keyof AppColors][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceMuted'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['primary', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['danger', 'surface'],
  ['danger', 'dangerSoft'],
  ['success', 'successSoft'],
  ['warning', 'warningSoft'],
  ['info', 'infoSoft'],
  ['text', 'dangerSoft'],
  ['text', 'warningSoft'],
];

describe.each(['light', 'dark'] as const)('%s theme contrast (WCAG AA)', (scheme) => {
  const colors = appColorSchemes[scheme];

  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps muted text below body text in emphasis', () => {
    expect(contrast(colors.text, colors.surface)).toBeGreaterThan(
      contrast(colors.textMuted, colors.surface),
    );
  });

  it('separates the strong border from the page (non-text, 1.3:1 visible hairline)', () => {
    expect(contrast(colors.borderStrong, colors.surface)).toBeGreaterThanOrEqual(1.3);
  });
});

describe('contrast()', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
});
