import { signInSchema, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useThemeColors } from '@/hooks/use-theme';
import { canUsePreview, signIn, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { firstIssueByField } from '@/lib/forms';
import { useI18n } from '@/lib/i18n';

type Field = 'email' | 'password';

export default function SignInScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { enterPreview } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, MessageKey>>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const issues = firstIssueByField(parsed.error);
      setFieldErrors({
        email: issues.email && 'auth.errors.invalidEmail',
        password: issues.password && 'auth.errors.passwordRequired',
      });
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    const result = await signIn(parsed.data);
    setSubmitting(false);

    // On success the root layout sees the new session and opens the app.
    if (!result.ok) setFormError(result.error);
  }

  return (
    <Screen title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      {!isSupabaseConfigured ? <Text muted>{t('auth.notConfigured')}</Text> : null}

      <View style={styles.form}>
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email && t(fieldErrors.email)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password && t(fieldErrors.password)}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        <Link
          href={{ pathname: '/forgot-password', params: { email: email.trim() } }}
          style={[styles.forgot, { color: colors.primary }]}
        >
          {t('auth.forgotPassword')}
        </Link>

        {formError ? (
          <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
            {t(formError)}
          </Text>
        ) : null}
        {formError === 'auth.errors.emailNotConfirmed' ? (
          <Button
            title={t('auth.resendVerification')}
            variant="soft"
            onPress={() =>
              router.push({ pathname: '/verify-email', params: { email: email.trim() } })
            }
          />
        ) : null}

        <Button
          title={t('auth.signIn')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isSupabaseConfigured}
        />
        {canUsePreview ? (
          <Button title={t('auth.previewEnter')} variant="soft" onPress={enterPreview} />
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text muted>{t('auth.noAccount')}</Text>
        <Link href="/sign-up" replace style={[styles.link, { color: colors.primary }]}>
          {t('auth.signUp')}
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  link: { fontSize: 16, fontWeight: '600' },
  forgot: { fontSize: 14, fontWeight: '600', alignSelf: 'flex-start' },
});
