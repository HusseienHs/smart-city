import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AuthCard, AuthFormSkeleton } from '@/components/auth/auth-card';
import { StaffSignUpForm } from '@/components/staff/staff-sign-up-form';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { ACCESS_PATH, signInHref } from '@/lib/auth/routes';
import { getStaffAccess } from '@/lib/auth/staff-context';
import { isSupabaseConfigured } from '@/lib/env';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { staffStrings } from '@/lib/staff/strings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('adminJoin.title') };
}

/**
 * Staff onboarding, reached through the link an administrator shares with an invited person.
 * It only creates an account (or sends existing users to sign in). Access comes later, on the
 * access page, from accepting an invitation addressed to the account's CONFIRMED email — the
 * page never shows or takes an invitation id, so nothing here reveals anyone's invitation.
 */
export default async function JoinPage() {
  const t = await getTranslator();
  return (
    <AuthCard title={t('adminJoin.title')} subtitle={t('adminJoin.subtitle')}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <JoinContent />
      </Suspense>
    </AuthCard>
  );
}

async function JoinContent() {
  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);
  if (!isSupabaseConfigured) return <Alert tone="warning">{t('adminAuth.notConfigured')}</Alert>;

  // Already signed in: the access page lists the invitations for this account's email.
  const access = await getStaffAccess();
  if (access.status === 'staff' || access.status === 'no-access') {
    redirect(localizedHref(locale, ACCESS_PATH));
  }

  const signIn = signInHref(locale, localizedHref(locale, ACCESS_PATH));
  return (
    <div className="flex flex-col gap-5">
      <Alert tone="info">{t('adminJoin.howItWorks')}</Alert>
      <section aria-labelledby="join-create" className="flex flex-col gap-3">
        <h2 id="join-create" className="text-md font-semibold text-foreground">
          {t('adminJoin.createTitle')}
        </h2>
        <StaffSignUpForm locale={locale} strings={staffStrings(locale)} signInHref={signIn} />
      </section>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-sm text-muted">{t('adminJoin.haveAccount')}</p>
        <ButtonLink href={signIn} variant="secondary" className="w-full">
          {t('adminJoin.signIn')}
        </ButtonLink>
      </div>
    </div>
  );
}
