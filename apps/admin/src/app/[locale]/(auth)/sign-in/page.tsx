import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthCard, AuthFormSkeleton } from '@/components/auth/auth-card';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Alert } from '@/components/ui/alert';
import { FORGOT_PASSWORD_PATH, isSignInNotice, JOIN_PATH } from '@/lib/auth/routes';
import { isSupabaseConfigured } from '@/lib/env';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('adminAuth.signInTitle') };
}

export default async function SignInPage({ searchParams }: PageProps<'/[locale]/sign-in'>) {
  const t = await getTranslator();
  return (
    <AuthCard title={t('adminAuth.signInTitle')} subtitle={t('adminAuth.signInSubtitle')}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
      <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted">
        <p>{t('adminAuth.staffOnlyNote')}</p>
        <JoinLink label={t('adminJoin.joinLink')} />
      </div>
    </AuthCard>
  );
}

async function SignInContent({
  searchParams,
}: Pick<PageProps<'/[locale]/sign-in'>, 'searchParams'>) {
  const locale = await getLocale();
  const t = await getTranslator();
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : undefined;
  const notice = isSignInNotice(params.notice) ? params.notice : undefined;

  if (!isSupabaseConfigured) return <Alert tone="warning">{t('adminAuth.notConfigured')}</Alert>;

  return (
    <div className="flex flex-col gap-5">
      {notice === 'session' ? <Alert tone="info">{t('adminAuth.sessionEnded')}</Alert> : null}
      {notice === 'signed-out' ? <Alert tone="success">{t('adminAuth.signedOut')}</Alert> : null}
      {notice === 'link' ? <Alert tone="warning">{t('auth.errors.linkExpired')}</Alert> : null}
      <SignInForm
        locale={locale}
        next={next}
        forgotPasswordHref={localizedHref(locale, FORGOT_PASSWORD_PATH)}
        labels={{
          email: t('auth.email'),
          password: t('auth.password'),
          forgotPassword: t('auth.forgotPassword'),
          submit: t('auth.signIn'),
          pending: t('adminAuth.signingIn'),
        }}
      />
    </div>
  );
}

/** Staff registration, for invited people who have no account yet. */
async function JoinLink({ label }: { label: string }) {
  const locale = await getLocale();
  return (
    <Link
      href={localizedHref(locale, JOIN_PATH)}
      className="font-medium text-accent hover:underline"
    >
      {label}
    </Link>
  );
}
