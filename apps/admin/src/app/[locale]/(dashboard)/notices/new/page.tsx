import { listNeighborhoods } from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { AnnouncementForm } from '@/components/notices/announcement-form';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BackLink, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import {
  canDraftAnnouncements,
  canPostMunicipalityWide,
  canPublishAnnouncement,
} from '@/lib/notices/capabilities';
import { noticeStrings } from '@/lib/notices/strings';
import { getNoticeWorkspace } from '@/lib/notices/workspace';

export function generateMetadata() {
  return moduleMetadata('notices');
}

export default function NewAnnouncementPage() {
  return (
    <ModuleGuard module="notices">
      <Suspense fallback={<StaffPageSkeleton />}>
        <NewAnnouncement />
      </Suspense>
    </ModuleGuard>
  );
}

async function NewAnnouncement() {
  const [locale, t, workspace] = await Promise.all([
    getLocale(),
    getTranslator(),
    getNoticeWorkspace(),
  ]);
  const { staff, departments, client, municipalityId } = workspace;
  const role = staff.active.role;
  const ownDepartment = staff.active.department_id;

  const back = (
    <BackLink
      href={localizedHref(locale, '/notices')}
      label={t('adminNotices.form.backToList')}
      className="mb-4"
    />
  );

  if (!canDraftAnnouncements(role, ownDepartment)) {
    return (
      <>
        {back}
        <Panel>
          <EmptyState
            icon="lock"
            title={t('adminNotices.form.noAccessTitle')}
            description={t('adminNotices.form.noAccessDescription')}
          />
        </Panel>
      </>
    );
  }

  const choices = canPostMunicipalityWide(role)
    ? departments
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: localizedText(d.name, locale) }))
    : null;
  const neighborhoods = (await listNeighborhoods(client, { municipalityId })).map((n) => ({
    id: n.id,
    name: localizedText(n.name, locale),
  }));
  const ownDepartmentName = staff.active.department_name
    ? localizedText(staff.active.department_name, locale)
    : null;

  return (
    <>
      {back}
      <PageHeader title={t('adminNotices.form.createTitle')} />
      <Panel className="animate-enter">
        <AnnouncementForm
          locale={locale}
          strings={noticeStrings(locale)}
          departments={choices}
          neighborhoods={neighborhoods}
          ownDepartmentName={ownDepartmentName}
          canPublishOwn={canPublishAnnouncement(role, ownDepartment, ownDepartment)}
        />
      </Panel>
    </>
  );
}
