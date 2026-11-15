import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Alert } from '@/components/ui/alert';
import { signInHref } from '@/lib/auth/routes';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocale, getTranslator } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('auth.forgotPasswordTitle') };
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = await getTranslator();
  return (
    <AuthCard
      title={t('auth.forgotPasswordTitle')}
      subtitle={t('adminAuth.forgotPasswordSubtitle')}
    >
      {isSupabaseConfigured ? (
        <ForgotPasswordForm
          locale={locale}
          signInHref={signInHref(locale)}
          labels={{
            email: t('auth.email'),
            submit: t('auth.sendResetLink'),
            pending: t('adminAuth.sending'),
            sentTitle: t('auth.resetLinkSentTitle'),
            sentDescription: t('auth.resetLinkSentDescription'),
            backToSignIn: t('auth.backToSignIn'),
          }}
        />
      ) : (
        <Alert tone="warning">{t('adminAuth.notConfigured')}</Alert>
      )}
    </AuthCard>
  );
}
