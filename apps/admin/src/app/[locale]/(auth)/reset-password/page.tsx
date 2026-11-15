import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard, AuthFormSkeleton } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { FORGOT_PASSWORD_PATH } from '@/lib/auth/routes';
import { getStaffAccess } from '@/lib/auth/staff-context';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('auth.resetPasswordTitle') };
}

/**
 * Reached from the password-reset email (via /auth/callback, which created a recovery
 * session). Without a session the link was expired, used, or opened in another browser.
 */
export default async function ResetPasswordPage() {
  const t = await getTranslator();
  return (
    <AuthCard title={t('auth.resetPasswordTitle')} subtitle={t('auth.resetPasswordSubtitle')}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetPasswordContent />
      </Suspense>
    </AuthCard>
  );
}

async function ResetPasswordContent() {
  const locale = await getLocale();
  const t = await getTranslator();
  const access = await getStaffAccess();

  if (access.status === 'signed-out' || access.status === 'unconfigured') {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="warning">
          <p className="font-medium text-foreground">{t('adminAuth.resetLinkMissingTitle')}</p>
          <p className="mt-0.5">{t('adminAuth.resetLinkMissingDescription')}</p>
        </Alert>
        <ButtonLink
          href={localizedHref(locale, FORGOT_PASSWORD_PATH)}
          variant="primary"
          className="w-full"
        >
          {t('adminAuth.requestNewLink')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <ResetPasswordForm
      locale={locale}
      labels={{
        newPassword: t('auth.newPassword'),
        confirmPassword: t('auth.confirmPassword'),
        hint: t('adminAuth.passwordHint'),
        submit: t('auth.updatePassword'),
        pending: t('adminAuth.saving'),
      }}
    />
  );
}
