import { signInSchema, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Notice } from '@/components/report/notice';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { requestPasswordReset } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { useI18n } from '@/lib/i18n';

const emailSchema = signInSchema.shape.email;

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [emailError, setEmailError] = useState<MessageKey | null>(null);
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setEmailError('auth.errors.invalidEmail');
      return;
    }
    setEmailError(null);

    setSubmitting(true);
    const result = await requestPasswordReset(parsed.data);
    setSubmitting(false);

    if (result.ok) setSentTo(parsed.data);
    else setFormError(result.error);
  }

  if (sentTo) {
    return (
      <Screen icon="key-outline" title={t('auth.forgotPasswordTitle')}>
        <EmptyState
          icon="mail-outline"
          title={t('auth.resetLinkSentTitle')}
          description={t('auth.resetLinkSentDescription', { email: sentTo })}
        />
        <Text muted style={styles.center}>
          {t('auth.openedOnThisPhone')}
        </Text>
        <Button title={t('auth.backToSignIn')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen
      icon="key-outline"
      title={t('auth.forgotPasswordTitle')}
      subtitle={t('auth.forgotPasswordSubtitle')}
    >
      {!isSupabaseConfigured ? <Text muted>{t('auth.notConfigured')}</Text> : null}

      <View style={styles.form}>
        <TextField
          label={t('auth.email')}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          error={emailError ? t(emailError) : undefined}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />

        {formError ? <Notice tone="error" message={t(formError)} /> : null}

        <Button
          title={t('auth.sendResetLink')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isSupabaseConfigured}
        />
        <Button
          title={t('auth.backToSignIn')}
          variant="soft"
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  center: { textAlign: 'center' },
});
