import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

export interface PickerOption {
  id: string;
  label: string;
}

interface OptionPickerProps {
  label: string;
  value: string | null;
  options: readonly PickerOption[];
  onChange: (id: string | null) => void;
  placeholder: string;
  noneLabel: string;
  loading?: boolean;
  /** Translated error with a retry, shown instead of the options. */
  error?: { message: string; retryLabel: string; onRetry: () => void };
  disabled?: boolean;
}

/** Labeled select that expands inline (no modal or extra dependency). */
export function OptionPicker({
  label,
  value,
  options,
  onChange,
  placeholder,
  noneLabel,
  loading = false,
  error,
  disabled = false,
}: OptionPickerProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  function choose(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityState={{ expanded: open, disabled }}
        style={[
          styles.control,
          { borderColor: colors.border, backgroundColor: colors.surface },
          disabled && styles.disabled,
        ]}
      >
        <Text style={styles.flex} muted={!selected}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <View
          style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.padded} />
          ) : error ? (
            <View style={styles.padded}>
              <Text style={{ color: colors.danger }}>{error.message}</Text>
              <Pressable onPress={error.onRetry} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.retry, { color: colors.primary }]}>{error.retryLabel}</Text>
              </Pressable>
            </View>
          ) : (
            [{ id: '', label: noneLabel }, ...options].map((option) => {
              const isSelected = option.id === (value ?? '');
              return (
                <Pressable
                  key={option.id || 'none'}
                  onPress={() => choose(option.id || null)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  style={({ pressed }) => [
                    styles.option,
                    { borderBottomColor: colors.border },
                    pressed && styles.disabled,
                  ]}
                >
                  <Text style={styles.flex}>{option.label}</Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  list: { borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  padded: { padding: spacing.md, gap: spacing.sm },
  retry: { fontWeight: '600' },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
});
