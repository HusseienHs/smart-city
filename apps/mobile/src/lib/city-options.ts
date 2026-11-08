/**
 * Picker options for municipalities: the name in the user's language (Hebrew fallback),
 * sorted alphabetically for that language, searchable by the name in every language.
 */
import type { Locale, LocalizedText } from '@smart-city/shared';

import type { SearchableOption } from './option-search';

/** Localized name with the documented fallback: the locale, then Hebrew (always present). */
export function localizedName(name: LocalizedText, locale: Locale): string {
  return name[locale] || name.he;
}

export function municipalityOptions(
  municipalities: readonly { id: string; name: LocalizedText }[],
  locale: Locale,
): SearchableOption[] {
  const collator = new Intl.Collator(locale);
  return municipalities
    .map((municipality) => ({
      id: municipality.id,
      label: localizedName(municipality.name, locale),
      keywords: [municipality.name.he, municipality.name.ar, municipality.name.en]
        .filter(Boolean)
        .join(' '),
    }))
    .sort((a, b) => collator.compare(a.label, b.label));
}
