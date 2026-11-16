import {
  listStaffInvitations,
  type InvitationState,
  type StaffInvitationRecord,
} from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { AdminOnly } from '@/components/staff/admin-only';
import { ConfirmActionForm } from '@/components/staff/confirm-action-form';
import { CopyLink } from '@/components/staff/copy-link';
import { InviteForm } from '@/components/staff/invite-form';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { BackLink, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { roleLabel } from '@/lib/auth/role-label';
import { JOIN_PATH } from '@/lib/auth/routes';
import { siteOrigin } from '@/lib/auth/site-url';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { formatDate } from '@/lib/reports/format';
import { reinviteAction, revokeInvitationAction } from '@/lib/staff/actions';
import { invitationActions } from '@/lib/staff/capabilities';
import { staffStrings } from '@/lib/staff/strings';
import { getStaffWorkspace } from '@/lib/staff/workspace';

export function generateMetadata() {
  return moduleMetadata('employees');
}

export default function InvitationsPage() {
  return (
    <ModuleGuard module="employees">
      <Suspense fallback={<StaffPageSkeleton />}>
        <AdminOnly>
          <Invitations />
        </AdminOnly>
      </Suspense>
    </ModuleGuard>
  );
}

const STATE_TONES: Readonly<Record<InvitationState, BadgeTone>> = {
  pending: 'info',
  expired: 'warning',
  accepted: 'success',
  declined: 'neutral',
  revoked: 'danger',
};

async function Invitations() {
  const [workspace, locale, t] = await Promise.all([
    getStaffWorkspace(),
    getLocale(),
    getTranslator(),
  ]);
  const { client, municipalityId, departments } = workspace;
  const strings = staffStrings(locale);
  const departmentName = new Map(departments.map((d) => [d.id, localizedText(d.name, locale)]));
  const activeDepartments = departments
    .filter((d) => d.isActive)
    .map((d) => ({ id: d.id, label: localizedText(d.name, locale) }));
  const link = `${await siteOrigin()}${localizedHref(locale, JOIN_PATH)}`;
  const linkLabels = {
    copy: t('adminInvitations.copy'),
    copied: t('adminInvitations.copied'),
    failed: t('adminInvitations.copyFailed'),
  };

  let invitations: StaffInvitationRecord[] | null = null;
  try {
    invitations = await listStaffInvitations(client, { municipalityId });
  } catch (error) {
    console.error('[invitations] load failed', error instanceof Error ? error.name : 'unknown');
  }

  return (
    <>
      <BackLink
        href={localizedHref(locale, '/employees')}
        label={t('adminEmployees.detail.backToList')}
        className="mb-4"
      />
      <PageHeader
        title={t('adminEmployees.invitations')}
        description={t('adminInvitations.subtitle')}
      />

      <div className="grid animate-enter items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Panel
          title={t('adminInvitations.newTitle')}
          description={t('adminInvitations.newDescription')}
          icon="userPlus"
        >
          <InviteForm locale={locale} strings={strings} departments={activeDepartments} />
        </Panel>

        <Panel title={t('adminInvitations.linkTitle')} icon="link">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('adminInvitations.linkDescription')}</p>
            <CopyLink value={link} labels={linkLabels} />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t('adminInvitations.instructionsTitle')}
              </h3>
              <ol className="space-y-2.5 text-sm text-foreground-secondary">
                {(
                  [
                    'adminInvitations.instructions1',
                    'adminInvitations.instructions2',
                    'adminInvitations.instructions3',
                    'adminInvitations.instructions4',
                  ] as const
                ).map((key, index) => (
                  <li key={key} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-2xs font-semibold text-muted tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <span className="pt-px">{t(key)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title={t('adminInvitations.listTitle')}
        icon="mail"
        flush
        className="mt-6"
        actions={
          invitations && invitations.length > 0 ? (
            <Badge size="sm" className="tabular-nums">
              {invitations.length}
            </Badge>
          ) : null
        }
      >
        {invitations === null ? (
          <EmptyState icon="alert" title={t('adminInvitations.loadError')}>
            <ButtonLink href={localizedHref(locale, '/employees/invitations')} variant="primary">
              {t('common.retry')}
            </ButtonLink>
          </EmptyState>
        ) : invitations.length === 0 ? (
          <EmptyState icon="mail" size="compact" title={t('adminInvitations.empty')} />
        ) : (
          <ul className="divide-y divide-border">
            {invitations.map((invitation) => {
              const actions = invitationActions(invitation.state);
              const fields = { locale, invitationId: invitation.id };
              return (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-subtle lg:flex-row lg:items-start"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-muted max-lg:hidden"
                  >
                    <Icon name="mail" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium break-all text-foreground" dir="ltr">
                        {invitation.email}
                      </span>
                      <Badge tone={STATE_TONES[invitation.state]} dot>
                        {t(`adminInvitations.state.${invitation.state}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {roleLabel(t, invitation.role)}
                      {invitation.department_id
                        ? ` · ${departmentName.get(invitation.department_id) ?? '—'}`
                        : ''}
                      {invitation.job_title ? ` · ${invitation.job_title}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      {t('adminInvitations.sent', {
                        date: formatDate(locale, invitation.created_at),
                      })}
                      {' · '}
                      {invitation.state === 'pending'
                        ? t('adminInvitations.expires', {
                            date: formatDate(locale, invitation.expires_at),
                          })
                        : invitation.state === 'expired'
                          ? t('adminInvitations.expired', {
                              date: formatDate(locale, invitation.expires_at),
                            })
                          : invitation.responded_at
                            ? t('adminInvitations.responded', {
                                date: formatDate(locale, invitation.responded_at),
                              })
                            : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-sm">
                    {actions.reinvite ? (
                      <ConfirmActionForm
                        action={reinviteAction}
                        fields={fields}
                        label={t('adminInvitations.reinvite')}
                        pendingLabel={t('adminStaff.saving')}
                        size="sm"
                        confirmTitle={t('adminInvitations.confirmReinviteTitle', {
                          email: invitation.email,
                        })}
                        confirmBody={t('adminInvitations.confirmReinvite')}
                        confirmLabel={t('adminInvitations.reinvite')}
                        cancelLabel={t('adminStaff.cancel')}
                        linkLabels={linkLabels}
                      />
                    ) : null}
                    {actions.revoke ? (
                      <ConfirmActionForm
                        action={revokeInvitationAction}
                        fields={fields}
                        label={t('adminInvitations.revoke')}
                        pendingLabel={t('adminStaff.saving')}
                        variant="ghost"
                        size="sm"
                        danger
                        confirmTitle={t('adminInvitations.confirmRevokeTitle', {
                          email: invitation.email,
                        })}
                        confirmBody={t('adminInvitations.confirmRevoke')}
                        confirmLabel={t('adminInvitations.revoke')}
                        cancelLabel={t('adminStaff.cancel')}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
