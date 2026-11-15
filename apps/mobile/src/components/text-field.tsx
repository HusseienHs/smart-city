import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

import { Text } from './text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Already-translated error message shown under the field. */
  error?: string;
  /** Already-translated helper text shown under the field when there is no error. */
  hint?: string;
  /** Optional icon at the start of the input. */
  icon?: ComponentProps<typeof Ionicons>['name'];
}

/**
 * Labeled text input with a clear focus ring, an inline error message and, for password
 * fields, a show/hide toggle.
 */
export function TextField({
  label,
  error,
  hint,
  icon,
  secureTextEntry,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const isMultiline = Boolean(inputProps.multiline);
  const isDisabled = inputProps.editable === false;

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <View
        style={[
          styles.control,
          isMultiline && styles.multilineControl,
          {
            backgroundColor: isDisabled ? colors.surfaceMuted : colors.surface,
            borderColor,
          },
          focused && !error && { shadowColor: colors.primary, ...styles.focusGlow },
          isDisabled && styles.disabled,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={focused ? colors.primary : colors.textMuted}
            style={isMultiline ? styles.iconTop : undefined}
          />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !revealed}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, isMultiline && styles.multiline, { color: colors.text }]}
          {...inputProps}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            hitSlop={10}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.message}>
          <Ionicons name="alert-circle" size={15} color={colors.danger} />
          <Text
            variant="caption"
            style={[styles.flex, { color: colors.danger }]}
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  multilineControl: { alignItems: 'flex-start' },
  focusGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 16,
    writingDirection: 'auto',
  },
  multiline: { minHeight: 140, paddingVertical: spacing.md, textAlignVertical: 'top' },
  iconTop: { marginTop: 15 },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  disabled: { opacity: 0.7 },
});
