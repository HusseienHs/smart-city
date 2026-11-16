import { countOpenReportsAssignedTo } from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { AdminOnly } from '@/components/staff/admin-only';
import { ConfirmActionForm } from '@/components/staff/confirm-action-form';
import { JobTitleForm, RoleForm } from '@/components/staff/employee-forms';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { EmptyState } from '@/components/ui/empty-state';
import { Masthead } from '@/components/ui/masthead';
import { BackLink } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { roleLabel } from '@/lib/auth/role-label';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { formatDateTime } from '@/lib/reports/format';
import { setEmployeeActiveAction } from '@/lib/staff/actions';
import { handoverCandidates } from '@/lib/staff/capabilities';
import { staffStrings } from '@/lib/staff/strings';
import { getStaffWorkspace } from '@/lib/staff/workspace';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateMetadata() {
  return moduleMetadata('employees');
}

export default function EmployeePage({ params }: PageProps<'/[locale]/employees/[employeeId]'>) {
  return (
    <ModuleGuard module="employees">
      <Suspense fallback={<StaffPageSkeleton />}>
        <AdminOnly>
          <EmployeeDetails params={params} />
        </AdminOnly>
      </Suspense>
    </ModuleGuard>
  );
}

async function EmployeeDetails({
  params,
}: {
  params: PageProps<'/[locale]/employees/[employeeId]'>['params'];
}) {
  const [{ employeeId }, workspace, locale, t] = await Promise.all([
    params,
    getStaffWorkspace(),
    getLocale(),
    getTranslator(),
  ]);
  const { staff, client, municipalityId, departments, directory } = workspace;
  const back = (
    <BackLink
      href={localizedHref(locale, '/employees')}
      label={t('adminEmployees.detail.backToList')}
      className="mb-4"
    />
  );

  // The directory holds only this municipality's memberships (get_municipality_staff).
  const member = UUID.test(employeeId)
    ? directory.find((entry) => entry.employeeId === employeeId.toLowerCase())
    : undefined;
  if (!member) {
    return (
      <>
        {back}
        <Panel>
          <EmptyState
            icon="employees"
            title={t('adminEmployees.detail.notFoundTitle')}
            description={t('adminEmployees.detail.notFoundDescription')}
          />
        </Panel>
      </>
    );
  }

  const strings = staffStrings(locale);
  const name = member.fullName?.trim() || t('adminEmployees.unnamed');
  const isSelf = member.employeeId === staff.active.employee_id;
  const openReports = await countOpenReportsAssignedTo(client, {
    municipalityId,
    employeeId: member.employeeId,
  }).catch(() => 0);
  const departmentName = new Map(departments.map((d) => [d.id, localizedText(d.name, locale)]));
  const activeDepartments = departments
    .filter((d) => d.isActive)
    .map((d) => ({ id: d.id, label: localizedText(d.name, locale) }));
  const candidates = handoverCandidates(directory, member.departmentId, member.employeeId).map(
    (c) => ({
      id: c.employeeId,
      label: c.fullName?.trim() || t('adminEmployees.unnamed'),
    }),
  );

  return (
    <>
      {back}
      <Masthead
        title={name}
        emblem={<Avatar name={name} size="xl" className="size-[72px] rounded-2xl text-2xl" />}
        description={member.jobTitle ?? undefined}
        meta={
          <>
            <Badge tone={member.isActive ? 'success' : 'neutral'} dot>
              {member.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
            </Badge>
            <Badge>{roleLabel(t, member.role)}</Badge>
            {isSelf ? <Badge tone="primary">{t('adminEmployees.you')}</Badge> : null}
          </>
        }
      />

      {isSelf ? (
        <Alert tone="info" className="mb-6">
          {t('adminEmployees.detail.selfNotice')}
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 animate-enter flex-col gap-6">
          <Panel title={t('adminEmployees.detail.membership')} icon="account">
            <DescriptionList
              layout="inline"
              items={[
                {
                  label: t('adminEmployees.columns.role'),
                  icon: 'roles',
                  value: (
                    <Badge tone={member.role === 'municipality_admin' ? 'violet' : 'neutral'}>
                      {roleLabel(t, member.role)}
                    </Badge>
                  ),
                },
                {
                  label: t('adminEmployees.columns.department'),
                  icon: 'departments',
                  value: member.departmentId
                    ? (departmentName.get(member.departmentId) ?? '—')
                    : '—',
                },
                {
                  label: t('adminEmployees.detail.memberSince'),
                  icon: 'clock',
                  value: (
                    <span className="tabular-nums">
                      {member.createdAt ? formatDateTime(locale, member.createdAt) : '—'}
                    </span>
                  ),
                },
                {
                  label: t('adminEmployees.detail.openReports'),
                  icon: 'reports',
                  value: <span className="font-medium tabular-nums">{openReports}</span>,
                },
              ]}
            />
          </Panel>

          {!isSelf ? (
            <Panel title={t('adminEmployees.role.title')} icon="roles">
              {member.isActive ? (
                <RoleForm
                  locale={locale}
                  strings={strings}
                  employee={{
                    id: member.employeeId,
                    name,
                    role: member.role,
                    departmentId: member.departmentId,
                  }}
                  departments={activeDepartments}
                  handoverCandidates={candidates}
                  openReports={openReports}
                />
              ) : (
                <p className="text-sm text-muted">{t('adminEmployees.role.inactiveNotice')}</p>
              )}
            </Panel>
          ) : null}
        </div>

        {!isSelf ? (
          <aside className="flex min-w-0 animate-enter flex-col gap-6">
            <Panel title={t('adminEmployees.detail.jobTitle')} icon="tag">
              <JobTitleForm
                locale={locale}
                strings={strings}
                employeeId={member.employeeId}
                jobTitle={member.jobTitle}
              />
            </Panel>
            <Panel
              title={t('adminEmployees.activation.title')}
              icon={member.isActive ? 'alert' : 'checkCircle'}
              // Deactivation is the one destructive action on this page: it reads as a danger zone.
              className={member.isActive ? 'border-danger-border' : undefined}
            >
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  {member.isActive
                    ? t('adminEmployees.activation.activeDescription')
                    : t('adminEmployees.activation.inactiveDescription')}
                </p>
                <ConfirmActionForm
                  action={setEmployeeActiveAction}
                  fields={{
                    locale,
                    employeeId: member.employeeId,
                    active: member.isActive ? 'false' : 'true',
                  }}
                  label={
                    member.isActive
                      ? t('adminEmployees.activation.deactivate')
                      : t('adminEmployees.activation.activate')
                  }
                  pendingLabel={t('adminStaff.saving')}
                  variant={member.isActive ? 'danger' : 'primary'}
                  danger={member.isActive}
                  confirmTitle={
                    member.isActive
                      ? t('adminEmployees.activation.confirmDeactivateTitle', { name })
                      : t('adminEmployees.activation.confirmActivateTitle', { name })
                  }
                  confirmBody={
                    member.isActive
                      ? t('adminEmployees.activation.confirmDeactivate', { count: openReports })
                      : t('adminEmployees.activation.confirmActivate')
                  }
                  confirmLabel={t('adminStaff.confirm')}
                  cancelLabel={t('adminStaff.cancel')}
                />
              </div>
            </Panel>
          </aside>
        ) : null}
      </div>
    </>
  );
}
