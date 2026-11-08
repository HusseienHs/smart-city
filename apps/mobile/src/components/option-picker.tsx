import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { filterOptions } from '@/lib/option-search';

import { Text } from './text';

export interface PickerOption {
  id: string;
  label: string;
  /** Extra text the search matches, e.g. the name in other languages. */
  keywords?: string;
}

/** Search box for long lists: placeholder and the text shown when nothing matches. */
export interface PickerSearch {
  placeholder: string;
  noResults: string;
}

interface OptionPickerProps {
  label: string;
  value: string | null;
  options: readonly PickerOption[];
  onChange: (id: string | null) => void;
  placeholder: string;
  /** The "no choice" row. Omit it when a choice is required. */
  noneLabel?: string;
  /** Adds a search box and a scrollable list (for long lists such as cities). */
  search?: PickerSearch;
  /** Already-translated validation error shown under the field. */
  fieldError?: string;
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
  search,
  fieldError,
  loading = false,
  error,
  disabled = false,
}: OptionPickerProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.id === value);
  const shown = useMemo(
    () => (search ? filterOptions(options, query) : [...options]),
    [options, query, search],
  );
  const rows = [
    ...(noneLabel !== undefined && !query ? [{ id: '', label: noneLabel }] : []),
    ...shown,
  ];

  function choose(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  const optionRows = rows.map((option) => {
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
        {isSelected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
      </Pressable>
    );
  });

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
          {
            borderColor: fieldError ? colors.danger : colors.border,
            backgroundColor: colors.surface,
          },
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
          ) : search ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={search.placeholder}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={search.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.search, { color: colors.text, borderBottomColor: colors.border }]}
              />
              <ScrollView
                style={styles.scroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {rows.length ? (
                  optionRows
                ) : (
                  <Text muted style={styles.padded}>
                    {search.noResults}
                  </Text>
                )}
              </ScrollView>
            </>
          ) : (
            optionRows
          )}
        </View>
      ) : null}
      {fieldError ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {fieldError}
        </Text>
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
  search: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: { maxHeight: 320 },
  retry: { fontWeight: '600' },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
});
