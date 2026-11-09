import { signInSchema, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Notice } from '@/components/report/notice';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useThemeColors } from '@/hooks/use-theme';
import { authRedirectInfo, resendVerification } from '@/lib/auth';
import { devRedirectNoticeKey, isDevelopmentEnv } from '@/lib/auth-redirect';
import { useI18n } from '@/lib/i18n';

/** Supabase limits confirmation emails; this keeps users from hitting the limit by accident. */
const RESEND_COOLDOWN_SECONDS = 60;

/** Inlined at build time: the notice below never exists in production builds. */
const showLinkDiagnostics = isDevelopmentEnv(process.env.NODE_ENV);

/**
 * Shown after sign-up, from sign-in when the email isn't confirmed yet, and from an expired or
 * invalid email link ("Send a new link"; then without an email, which the user enters).
 */
export default function VerifyEmailScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ email?: string }>();
  const knownEmail = params.email ?? '';
  const [typedEmail, setTypedEmail] = useState('');
  const [emailError, setEmailError] = useState<MessageKey | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: MessageKey } | null>(null);
  const email = knownEmail || typedEmail.trim();
  // Development only: where the link in the email will open (see auth-redirect.ts).
  const redirect = useMemo(() => (showLinkDiagnostics ? authRedirectInfo() : null), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!knownEmail && !signInSchema.shape.email.safeParse(email).success) {
      setEmailError('auth.errors.invalidEmail');
      return;
    }
    setEmailError(null);
    setResult(null);
    setSending(true);
    const response = await resendVerification(email);
    setSending(false);
    if (response.ok) {
      setResult({ ok: true, message: 'auth.verificationResent' });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setResult({ ok: false, message: response.error });
    }
  }

  return (
    <Screen icon="mail-unread-outline" title={t('auth.signUpTitle')}>
      <EmptyState
        icon="mail-outline"
        title={t('auth.checkEmailTitle')}
        description={
          knownEmail
            ? t('auth.checkEmailDescription', { email: knownEmail })
            : t('auth.newLinkHint')
        }
      />
      <Text muted style={styles.center}>
        {t('auth.openedOnThisPhone')}
      </Text>

      {redirect ? (
        <Notice
          icon="construct-outline"
          tone={redirect.problem ? 'error' : 'info'}
          message={t(devRedirectNoticeKey(redirect), { url: redirect.url || '—' })}
        />
      ) : null}

      <View style={styles.actions}>
        {knownEmail ? null : (
          <TextField
            label={t('auth.email')}
            icon="mail-outline"
            value={typedEmail}
            onChangeText={(value) => {
              setTypedEmail(value);
              setEmailError(null);
            }}
            error={emailError ? t(emailError) : undefined}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={handleResend}
          />
        )}
        {result ? (
          <Text
            style={[styles.center, { color: result.ok ? colors.primary : colors.danger }]}
            accessibilityLiveRegion="polite"
          >
            {t(result.message, { email })}
          </Text>
        ) : null}
        <Button
          title={
            cooldown > 0
              ? t('auth.resendIn', { seconds: cooldown })
              : knownEmail
                ? t('auth.resendVerification')
                : t('auth.sendNewLink')
          }
          variant={knownEmail ? 'soft' : 'primary'}
          onPress={handleResend}
          loading={sending}
          disabled={cooldown > 0}
        />
        {knownEmail ? null : (
          // An expired password-reset link also lands here: offer that flow too.
          <Link
            href={{ pathname: '/forgot-password', params: { email } }}
            style={[styles.link, { color: colors.primary }]}
          >
            {t('auth.forgotPassword')}
          </Link>
        )}
        <Button
          title={t('auth.backToSignIn')}
          variant={knownEmail ? 'primary' : 'secondary'}
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  actions: { gap: spacing.md },
  link: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
