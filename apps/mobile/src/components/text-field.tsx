import { radii, spacing } from '@smart-city/shared';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Already-translated error message shown under the field. */
  error?: string;
}

/** Labeled text input with an inline error message. */
export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.field}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
        {...inputProps}
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: 16,
    writingDirection: 'auto',
  },
});
