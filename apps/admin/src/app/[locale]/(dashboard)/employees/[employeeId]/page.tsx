import { countOpenReportsAssignedTo } from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { AdminOnly } from '@/components/staff/admin-only';
import { ConfirmActionForm } from '@/components/staff/confirm-action-form';
import { JobTitleForm, RoleForm } from '@/components/staff/employee-forms';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
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
    <ButtonLink
      href={localizedHref(locale, '/employees')}
      variant="ghost"
      size="sm"
      icon="chevronEnd"
      className="mb-3 [&>svg]:rotate-180"
    >
      {t('adminEmployees.detail.backToList')}
    </ButtonLink>
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
      <PageHeader
        title={name}
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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t('adminEmployees.detail.membership')}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted">
                  {t('adminEmployees.columns.role')}
                </dt>
                <dd className="text-sm">{roleLabel(t, member.role)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">
                  {t('adminEmployees.columns.department')}
                </dt>
                <dd className="text-sm">
                  {member.departmentId ? (departmentName.get(member.departmentId) ?? '—') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">
                  {t('adminEmployees.detail.memberSince')}
                </dt>
                <dd className="text-sm">
                  {member.createdAt ? formatDateTime(locale, member.createdAt) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">
                  {t('adminEmployees.detail.openReports')}
                </dt>
                <dd className="text-sm">{openReports}</dd>
              </div>
            </dl>
          </Panel>

          {!isSelf ? (
            <Panel title={t('adminEmployees.role.title')}>
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
          <aside className="flex min-w-0 flex-col gap-6">
            <Panel title={t('adminEmployees.detail.jobTitle')}>
              <JobTitleForm
                locale={locale}
                strings={strings}
                employeeId={member.employeeId}
                jobTitle={member.jobTitle}
              />
            </Panel>
            <Panel title={t('adminEmployees.activation.title')}>
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
