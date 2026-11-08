import { describe, expect, it } from 'vitest';

import { filterOptions, normalizeForSearch } from './option-search';

const cities = [
  { id: 'bsv', label: "Be'er Sheva", keywords: 'באר שבע بئر السبع' },
  { id: 'hfa', label: 'Haifa', keywords: 'חיפה حيفا' },
  { id: 'tlv', label: 'Tel Aviv-Yafo', keywords: 'תל אביב-יפו تل أبيب - يافا' },
];

describe('normalizeForSearch', () => {
  it('ignores case, apostrophes, hyphens and extra spaces', () => {
    expect(normalizeForSearch("  Be'er   SHEVA ")).toBe('beer sheva');
    expect(normalizeForSearch('Tel Aviv-Yafo')).toBe('tel avivyafo');
  });
});

describe('filterOptions', () => {
  it('returns everything for an empty query', () => {
    expect(filterOptions(cities, '  ')).toHaveLength(3);
  });

  it('matches the label without punctuation', () => {
    expect(filterOptions(cities, 'beer').map((c) => c.id)).toEqual(['bsv']);
  });

  it('matches the name in other languages', () => {
    expect(filterOptions(cities, 'חיפה').map((c) => c.id)).toEqual(['hfa']);
    expect(filterOptions(cities, 'حيفا').map((c) => c.id)).toEqual(['hfa']);
    expect(filterOptions(cities, 'תל אביב').map((c) => c.id)).toEqual(['tlv']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterOptions(cities, 'eilat')).toEqual([]);
  });
});

describe('normalizeForSearch with diacritics', () => {
  it('ignores Hebrew niqqud, Arabic harakat, geresh and maqaf', () => {
    expect(normalizeForSearch('חֵיפָה')).toBe('חיפה');
    expect(normalizeForSearch('حَيْفَا')).toBe('حيفا');
    expect(normalizeForSearch('סח׳נין')).toBe('סחנין');
    expect(normalizeForSearch('תל אביב־יפו')).toBe('תל אביביפו');
  });
});
