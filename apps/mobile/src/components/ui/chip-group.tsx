import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { radius, spacing } from '@/theme/metrics';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label. */
  count?: number;
}

interface ChipGroupProps<T extends string> {
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Single-choice filter pills; scrolls horizontally and mirrors in RTL. */
export function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: ChipGroupProps<T>) {
  const colors = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const label =
          option.count === undefined ? option.label : `${option.label} · ${option.count}`;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
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
              variant="label"
              style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}
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
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
