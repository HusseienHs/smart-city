import { signUpSchema, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useThemeColors } from '@/hooks/use-theme';
import { signOut, updatePassword, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

const passwordSchema = signUpSchema.shape.password;

/**
 * Reached only through a password-recovery link (see the root layout). Once the new password
 * is saved, the recovery state ends and the app opens.
 */
export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<MessageKey | null>(null);
  const [confirmationError, setConfirmationError] = useState<MessageKey | null>(null);
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleSubmit() {
    setFormError(null);
    const parsed = passwordSchema.safeParse(password);
    const nextPasswordError: MessageKey | null = parsed.success
      ? null
      : parsed.error.issues[0]?.code === 'too_big'
        ? 'auth.errors.passwordTooLong'
        : 'auth.errors.passwordTooShort';
    const nextConfirmationError: MessageKey | null =
      parsed.success && confirmation !== password ? 'auth.errors.passwordsDontMatch' : null;
    setPasswordError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (!parsed.success || nextConfirmationError) return;

    setSubmitting(true);
    const result = await updatePassword(parsed.data);
    setSubmitting(false);

    if (result.ok) finishPasswordRecovery();
    else setFormError(result.error);
  }

  async function handleCancel() {
    setCancelling(true);
    await signOut();
    setCancelling(false);
  }

  return (
    <Screen title={t('auth.resetPasswordTitle')} subtitle={t('auth.resetPasswordSubtitle')}>
      <View style={styles.form}>
        <TextField
          label={t('auth.newPassword')}
          value={password}
          onChangeText={setPassword}
          error={passwordError ? t(passwordError) : undefined}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
        <TextField
          label={t('auth.confirmPassword')}
          value={confirmation}
          onChangeText={setConfirmation}
          error={confirmationError ? t(confirmationError) : undefined}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {formError ? (
          <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
            {t(formError)}
          </Text>
        ) : null}

        <Button title={t('auth.updatePassword')} onPress={handleSubmit} loading={submitting} />
        <Button
          title={t('auth.cancel')}
          variant="secondary"
          onPress={handleCancel}
          loading={cancelling}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
