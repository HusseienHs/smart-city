import { describe, expect, it } from 'vitest';

import { fontFamilyFor, weightName } from './typography';

describe('fonts', () => {
  it('maps CSS weights to the bundled static faces', () => {
    expect(weightName(undefined)).toBe('Regular');
    expect(weightName('400')).toBe('Regular');
    expect(weightName('normal')).toBe('Regular');
    expect(weightName('500')).toBe('Medium');
    expect(weightName('600')).toBe('SemiBold');
    expect(weightName(700)).toBe('Bold');
    expect(weightName('800')).toBe('Bold');
    expect(weightName('bold')).toBe('Bold');
  });

  it('uses the script family of the active language', () => {
    expect(fontFamilyFor('en', '600')).toBe('NotoSans-SemiBold');
    expect(fontFamilyFor('he', '700')).toBe('NotoSansHebrew-Bold');
    expect(fontFamilyFor('ar', '400')).toBe('NotoSansArabic-Regular');
  });
});
