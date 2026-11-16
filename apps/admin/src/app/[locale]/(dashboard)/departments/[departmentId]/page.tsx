import { getDepartmentReportCounts } from '@smart-city/api';
import Link from 'next/link';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { ConfirmActionForm } from '@/components/staff/confirm-action-form';
import { DepartmentForm } from '@/components/staff/department-form';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Masthead } from '@/components/ui/masthead';
import { BackLink } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { roleLabel } from '@/lib/auth/role-label';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { setDepartmentActiveAction } from '@/lib/staff/actions';
import {
  canManageDepartments,
  canManageStaff,
  canSeeDepartmentReportCount,
  departmentDeactivationBlocked,
} from '@/lib/staff/capabilities';
import { staffStrings } from '@/lib/staff/strings';
import { getStaffWorkspace } from '@/lib/staff/workspace';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateMetadata() {
  return moduleMetadata('departments');
}

export default function DepartmentPage({
  params,
}: PageProps<'/[locale]/departments/[departmentId]'>) {
  return (
    <ModuleGuard module="departments">
      <Suspense fallback={<StaffPageSkeleton />}>
        <DepartmentDetails params={params} />
      </Suspense>
    </ModuleGuard>
  );
}

async function DepartmentDetails({
  params,
}: {
  params: PageProps<'/[locale]/departments/[departmentId]'>['params'];
}) {
  const [{ departmentId }, workspace, locale, t] = await Promise.all([
    params,
    getStaffWorkspace(),
    getLocale(),
    getTranslator(),
  ]);
  const { staff, client, municipalityId, departments, directory } = workspace;
  const listHref = localizedHref(locale, '/departments');
  const back = (
    <BackLink href={listHref} label={t('adminDepartments.detail.backToList')} className="mb-4" />
  );

  // Only departments of the active municipality are in the list (explicit filter + RLS).
  const department = UUID.test(departmentId)
    ? departments.find((d) => d.id === departmentId.toLowerCase())
    : undefined;
  if (!department) {
    return (
      <>
        {back}
        <Panel>
          <EmptyState
            icon="departments"
            title={t('adminDepartments.detail.notFoundTitle')}
            description={t('adminDepartments.detail.notFoundDescription')}
          />
        </Panel>
      </>
    );
  }

  const role = staff.active.role;
  const manage = canManageDepartments(role);
  const members = directory.filter((m) => m.isActive && m.departmentId === department.id);
  const showCount = canSeeDepartmentReportCount(role, staff.active.department_id, department.id);
  const counts = showCount
    ? await getDepartmentReportCounts(client, {
        municipalityId,
        departmentIds: [department.id],
      }).catch(() => null)
    : null;
  const strings = staffStrings(locale);
  const blocked = department.isActive && departmentDeactivationBlocked(members.length);

  return (
    <>
      {back}
      <Masthead
        title={localizedText(department.name, locale)}
        emblem={
          <span
            aria-hidden
            className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8a6] to-[#0f5f73] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
          >
            <Icon name="departments" className="size-8" />
          </span>
        }
        meta={
          <Badge tone={department.isActive ? 'success' : 'neutral'} dot>
            {department.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
          </Badge>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 animate-enter flex-col gap-6">
          <Panel title={t('adminDepartments.form.editTitle')} icon="edit">
            {manage ? (
              <DepartmentForm
                locale={locale}
                strings={strings}
                department={{
                  id: department.id,
                  name: department.name,
                  email: department.email,
                  phone: department.phone,
                }}
              />
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                {(['he', 'ar', 'en'] as const).map((language) => (
                  <div key={language}>
                    <dt className="text-xs font-medium text-muted">
                      {t(
                        language === 'he'
                          ? 'adminDepartments.form.nameHe'
                          : language === 'ar'
                            ? 'adminDepartments.form.nameAr'
                            : 'adminDepartments.form.nameEn',
                      )}
                    </dt>
                    <dd className="text-sm" lang={language} dir="auto">
                      {department.name[language] ?? '—'}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs font-medium text-muted">
                    {t('adminDepartments.form.email')}
                  </dt>
                  <dd className="text-sm" dir="ltr">
                    {department.email ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">
                    {t('adminDepartments.form.phone')}
                  </dt>
                  <dd className="text-sm" dir="ltr">
                    {department.phone ?? '—'}
                  </dd>
                </div>
              </dl>
            )}
          </Panel>

          <Panel
            title={t('adminDepartments.detail.members')}
            icon="employees"
            flush
            actions={
              <Badge size="sm" className="tabular-nums">
                {members.length}
              </Badge>
            }
          >
            {members.length === 0 ? (
              <EmptyState
                icon="employees"
                size="compact"
                title={t('adminDepartments.detail.noMembers')}
              />
            ) : (
              <ul className="divide-y divide-border">
                {members.map((member) => {
                  const name = member.fullName?.trim() || t('adminEmployees.unnamed');
                  const content = (
                    <>
                      <Avatar name={name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">{name}</span>
                        {member.jobTitle ? (
                          <span className="block text-sm text-muted">{member.jobTitle}</span>
                        ) : null}
                      </span>
                      <Badge>{roleLabel(t, member.role)}</Badge>
                    </>
                  );
                  return (
                    <li key={member.employeeId}>
                      {canManageStaff(role) ? (
                        <Link
                          href={localizedHref(locale, `/employees/${member.employeeId}`)}
                          className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 animate-enter flex-col gap-6">
          <Panel title={t('adminDepartments.detail.reports')} icon="reports">
            {counts ? (
              <div className="flex flex-col gap-4">
                <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {t('adminDepartments.detail.openReports', { count: counts[department.id] ?? 0 })}
                </p>
                <ButtonLink
                  href={`${localizedHref(locale, '/reports')}?department=${department.id}`}
                  variant="secondary"
                  icon="reports"
                >
                  {t('adminDepartments.detail.viewReports')}
                </ButtonLink>
              </div>
            ) : (
              <p className="text-sm text-muted">{t('adminDepartments.detail.reportsOwnOnly')}</p>
            )}
          </Panel>

          <Panel
            title={t('adminDepartments.activation.title')}
            icon={department.isActive ? 'alert' : 'checkCircle'}
            className={manage && department.isActive ? 'border-danger-border' : undefined}
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                {department.isActive
                  ? t('adminDepartments.activation.activeDescription')
                  : t('adminDepartments.activation.inactiveDescription')}
              </p>
              {manage ? (
                <>
                  {blocked ? (
                    <Alert tone="warning">
                      {t('adminDepartments.activation.blocked', { count: members.length })}
                    </Alert>
                  ) : null}
                  <ConfirmActionForm
                    action={setDepartmentActiveAction}
                    fields={{
                      locale,
                      departmentId: department.id,
                      active: department.isActive ? 'false' : 'true',
                    }}
                    label={
                      department.isActive
                        ? t('adminDepartments.activation.deactivate')
                        : t('adminDepartments.activation.activate')
                    }
                    pendingLabel={t('adminStaff.saving')}
                    variant={department.isActive ? 'danger' : 'primary'}
                    disabled={blocked}
                    danger={department.isActive}
                    confirmTitle={
                      department.isActive
                        ? t('adminDepartments.activation.confirmDeactivateTitle')
                        : t('adminDepartments.activation.confirmActivateTitle')
                    }
                    confirmBody={
                      department.isActive
                        ? t('adminDepartments.activation.confirmDeactivate')
                        : t('adminDepartments.activation.confirmActivate')
                    }
                    confirmLabel={t('adminStaff.confirm')}
                    cancelLabel={t('adminStaff.cancel')}
                  />
                </>
              ) : null}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
