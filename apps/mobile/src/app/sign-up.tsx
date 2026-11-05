import { signUpSchema, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useThemeColors } from '@/hooks/use-theme';
import { canUsePreview, signUp, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { firstIssueByField } from '@/lib/forms';
import { useI18n } from '@/lib/i18n';

type Field = 'fullName' | 'email' | 'password';

export default function SignUpScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { enterPreview } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, MessageKey>>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Set once the account exists but the email still has to be confirmed. */
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse({
      fullName,
      email: email.trim(),
      password,
      preferredLocale: locale,
    });
    if (!parsed.success) {
      const issues = firstIssueByField(parsed.error);
      setFieldErrors({
        fullName: issues.fullName && 'auth.errors.nameRequired',
        email: issues.email && 'auth.errors.invalidEmail',
        password:
          issues.password &&
          (issues.password.code === 'too_big'
            ? 'auth.errors.passwordTooLong'
            : 'auth.errors.passwordTooShort'),
      });
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    const result = await signUp(parsed.data);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    // Without email confirmation Supabase signs the user in right away, and the root layout
    // opens the app. Otherwise they confirm their email first, then sign in.
    if (result.needsConfirmation) setConfirmationSentTo(parsed.data.email);
  }

  if (confirmationSentTo) {
    return (
      <Screen title={t('auth.signUpTitle')}>
        <EmptyState
          icon="mail-outline"
          title={t('auth.checkEmailTitle')}
          description={t('auth.checkEmailDescription', { email: confirmationSentTo })}
        />
        <Button title={t('auth.signIn')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      {!isSupabaseConfigured ? <Text muted>{t('auth.notConfigured')}</Text> : null}

      <View style={styles.form}>
        <TextField
          label={t('auth.fullName')}
          value={fullName}
          onChangeText={setFullName}
          error={fieldErrors.fullName && t(fieldErrors.fullName)}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
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

        <Button
          title={t('auth.signUp')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isSupabaseConfigured}
        />
        {canUsePreview ? (
          <Button title={t('auth.previewEnter')} variant="soft" onPress={enterPreview} />
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text muted>{t('auth.haveAccount')}</Text>
        <Link href="/sign-in" replace style={[styles.link, { color: colors.primary }]}>
          {t('auth.signIn')}
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  link: { fontSize: 16, fontWeight: '600' },
});
