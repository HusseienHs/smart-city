import { describe, expect, it } from 'vitest';

import { localizedName, municipalityOptions } from './city-options';
import { filterOptions } from './option-search';

const haifa = { id: 'hfa', name: { he: 'חיפה', ar: 'حيفا', en: 'Haifa' } };
const akko = { id: 'ako', name: { he: 'עכו', ar: 'عكا', en: 'Akko' } };
const hebrewOnly = { id: 'x', name: { he: 'אילת' } };

describe('localizedName', () => {
  it('falls back to Hebrew', () => {
    expect(localizedName(hebrewOnly.name, 'en')).toBe('אילת');
    expect(localizedName(haifa.name, 'ar')).toBe('حيفا');
  });
});

describe('municipalityOptions', () => {
  it('labels in the user language and sorts alphabetically', () => {
    expect(municipalityOptions([haifa, akko], 'en').map((o) => o.label)).toEqual(['Akko', 'Haifa']);
    expect(municipalityOptions([akko, haifa], 'he').map((o) => o.label)).toEqual(['חיפה', 'עכו']);
  });

  it('is searchable in every language whatever the UI language', () => {
    const options = municipalityOptions([haifa, akko], 'en');
    expect(filterOptions(options, 'עכו').map((o) => o.id)).toEqual(['ako']);
    expect(filterOptions(options, 'حيفا').map((o) => o.id)).toEqual(['hfa']);
  });
});
