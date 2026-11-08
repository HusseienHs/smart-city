/**
 * Search for long pickers (cities). Matches the visible label and any extra keywords — for
 * municipalities, the name in every language — ignoring case, accents, Hebrew niqqud,
 * apostrophes/geresh and hyphens, so "beer sheva", "Be'er Sheva" and "באר שבע" all match.
 */
export interface SearchableOption {
  id: string;
  label: string;
  /** Extra text that should match, e.g. the name in other languages. */
  keywords?: string;
}

export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u065f]/g, '') // accents, niqqud, harakat
    .replace(/['\u2019`"\u05f4\u05f3\-\u2013\u05be]/g, '') // apostrophes, geresh, gershayim, hyphens, maqaf
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function filterOptions<T extends SearchableOption>(
  options: readonly T[],
  query: string,
): T[] {
  const needle = normalizeForSearch(query);
  if (!needle) return [...options];
  return options.filter((option) =>
    normalizeForSearch(`${option.label} ${option.keywords ?? ''}`).includes(needle),
  );
}
