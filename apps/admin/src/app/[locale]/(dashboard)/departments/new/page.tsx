import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { AdminOnly } from '@/components/staff/admin-only';
import { DepartmentForm } from '@/components/staff/department-form';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { BackLink, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { staffStrings } from '@/lib/staff/strings';

export function generateMetadata() {
  return moduleMetadata('departments');
}

export default function NewDepartmentPage() {
  return (
    <ModuleGuard module="departments">
      <Suspense fallback={<StaffPageSkeleton />}>
        <AdminOnly>
          <NewDepartment />
        </AdminOnly>
      </Suspense>
    </ModuleGuard>
  );
}

async function NewDepartment() {
  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);
  return (
    <>
      <BackLink
        href={localizedHref(locale, '/departments')}
        label={t('adminDepartments.detail.backToList')}
        className="mb-4"
      />
      <PageHeader title={t('adminDepartments.form.createTitle')} />
      <Panel>
        <DepartmentForm locale={locale} strings={staffStrings(locale)} />
      </Panel>
    </>
  );
}
