import { ChipGroup } from '@/components/ui/chip-group';
import { useI18n } from '@/lib/i18n';
import { NOTICE_FILTERS, type NoticeFilter } from '@/lib/notice-board';

interface FilterChipsProps {
  value: NoticeFilter;
  counts: Record<NoticeFilter, number>;
  onChange: (filter: NoticeFilter) => void;
}

/** Severity filters with counts. */
export function FilterChips({ value, counts, onChange }: FilterChipsProps) {
  const { t } = useI18n();
  return (
    <ChipGroup
      value={value}
      onChange={onChange}
      accessibilityLabel={t('notices.filterLabel')}
      options={NOTICE_FILTERS.map((filter) => ({
        value: filter,
        label: t(`notices.filters.${filter}`),
        count: counts[filter],
      }))}
    />
  );
}
