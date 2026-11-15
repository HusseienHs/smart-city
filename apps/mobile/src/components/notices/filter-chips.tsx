import { radii, spacing } from '@smart-city/shared';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { NOTICE_FILTERS, type NoticeFilter } from '@/lib/notice-board';

interface FilterChipsProps {
  value: NoticeFilter;
  counts: Record<NoticeFilter, number>;
  onChange: (filter: NoticeFilter) => void;
}

/** Severity filters with counts; scrolls horizontally (mirrored in RTL by the layout). */
export function FilterChips({ value, counts, onChange }: FilterChipsProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('notices.filterLabel')}
    >
      {NOTICE_FILTERS.map((filter) => {
        const selected = filter === value;
        const label = `${t(`notices.filters.${filter}`)} · ${counts[filter]}`;
        return (
          <Pressable
            key={filter}
            onPress={() => onChange(filter)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              variant="caption"
              style={[styles.text, { color: selected ? colors.onPrimary : colors.text }]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  text: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
