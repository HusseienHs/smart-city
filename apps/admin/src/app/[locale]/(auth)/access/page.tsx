import { getMyStaffInvitations, type StaffInvitation } from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import type { Translator } from '@smart-city/shared/i18n';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard, AuthFormSkeleton } from '@/components/auth/auth-card';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  acceptInvitationAction,
  declineInvitationAction,
  signOutAction,
  type InvitationNotice,
} from '@/lib/auth/actions';
import { roleLabel } from '@/lib/auth/role-label';
import { requireSignedIn } from '@/lib/auth/staff-context';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('adminAuth.accessTitle') };
}

/**
 * For any signed-in user: pending staff invitations (accept / decline), or an explanation when
 * the account has no municipal access. Staff reach it from the account menu.
 */
export default async function AccessPage({ searchParams }: PageProps<'/[locale]/access'>) {
  const t = await getTranslator();
  return (
    <AuthCard title={t('adminAuth.accessTitle')}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <AccessContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

const NOTICES: readonly InvitationNotice[] = ['accepted', 'declined', 'unavailable', 'error'];

async function AccessContent({
  searchParams,
}: Pick<PageProps<'/[locale]/access'>, 'searchParams'>) {
  const locale = await getLocale();
  const t = await getTranslator();
  const access = await requireSignedIn();
  const invitations = await getMyStaffInvitations(await createSupabaseServerClient());

  const params = await searchParams;
  const notice = NOTICES.find((value) => value === params.notice);
  const joined =
    notice === 'accepted' && access.status === 'staff'
      ? access.memberships.find((m) => m.municipality_id === params.municipality)
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        {t('auth.signedInAs', { email: access.user.email ?? '' })}
      </p>

      {joined ? (
        <Alert tone="success">
          {t('adminAuth.invitationAccepted', {
            municipality: localizedText(joined.municipality_name, locale),
          })}
        </Alert>
      ) : null}
      {notice === 'declined' ? (
        <Alert tone="info">{t('adminAuth.invitationDeclined')}</Alert>
      ) : null}
      {notice === 'unavailable' ? (
        <Alert tone="warning">{t('adminAuth.invitationUnavailable')}</Alert>
      ) : null}
      {notice === 'error' ? <Alert tone="danger">{t('apiErrors.server')}</Alert> : null}

      {access.status === 'staff' ? (
        <ButtonLink href={localizedHref(locale, '/')} variant="primary" className="w-full">
          {t('adminAuth.goToDashboard')}
        </ButtonLink>
      ) : null}

      {invitations.length > 0 ? (
        <section aria-labelledby="invitations-title" className="flex flex-col gap-3">
          <div>
            <h2 id="invitations-title" className="text-md font-semibold text-foreground">
              {t('adminAuth.invitationsTitle')}
            </h2>
            <p className="text-sm text-muted">{t('adminAuth.invitationsDescription')}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {invitations.map((invitation) => (
              <InvitationItem key={invitation.id} invitation={invitation} locale={locale} t={t} />
            ))}
          </ul>
        </section>
      ) : access.status === 'no-access' ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-border-strong px-5 py-8 text-center">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-primary-soft-border bg-primary-soft text-primary">
            <Icon name="roles" />
          </span>
          <p className="font-semibold text-foreground">{t('adminAuth.noAccessTitle')}</p>
          <p className="mt-1 text-sm text-muted">
            {t('adminAuth.noAccessDescription', { email: access.user.email ?? '' })}
          </p>
          <p className="mt-2 text-xs text-muted">{t('adminJoin.noInvitationHint')}</p>
        </div>
      ) : null}

      <form action={signOutAction} className="border-t border-border pt-4">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="ghost" icon="signOut" className="w-full">
          {t('auth.signOut')}
        </Button>
      </form>
    </div>
  );
}

function InvitationItem({
  invitation,
  locale,
  t,
}: {
  invitation: StaffInvitation;
  locale: Locale;
  t: Translator;
}) {
  const expires = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(invitation.expires_at),
  );
  const details = [
    roleLabel(t, invitation.role),
    invitation.department_name && localizedText(invitation.department_name, locale),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="rounded-md border border-border bg-surface-subtle p-4">
      <p className="font-semibold text-foreground">
        {localizedText(invitation.municipality_name, locale)}
      </p>
      <p className="mt-0.5 text-sm text-foreground-secondary">{details}</p>
      <p className="mt-0.5 text-xs text-muted">
        {t('adminAuth.invitationExpires', { date: expires })}
      </p>
      <div className="mt-3 flex gap-2">
        <form action={acceptInvitationAction} className="flex-1">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="invitationId" value={invitation.id} />
          <input type="hidden" name="municipalityId" value={invitation.municipality_id} />
          <SubmitButton
            variant="primary"
            size="sm"
            pendingLabel={t('adminAuth.saving')}
            className="w-full"
          >
            {t('adminAuth.accept')}
          </SubmitButton>
        </form>
        <form action={declineInvitationAction} className="flex-1">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="invitationId" value={invitation.id} />
          <SubmitButton
            variant="secondary"
            size="sm"
            pendingLabel={t('adminAuth.saving')}
            className="w-full"
          >
            {t('adminAuth.decline')}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
