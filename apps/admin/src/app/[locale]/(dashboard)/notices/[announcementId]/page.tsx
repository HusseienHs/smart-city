import { getStaffAnnouncement, listNeighborhoods, signAnnouncementImage } from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { AnnouncementForm } from '@/components/notices/announcement-form';
import { ConfirmActionForm } from '@/components/staff/confirm-action-form';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { deleteAnnouncementAction } from '@/lib/notices/actions';
import {
  announcementDisplayState,
  canDeleteDraft,
  canEditAnnouncement,
} from '@/lib/notices/capabilities';
import { noticeStrings } from '@/lib/notices/strings';
import { getNoticeWorkspace } from '@/lib/notices/workspace';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateMetadata() {
  return moduleMetadata('notices');
}

export default function AnnouncementPage({
  params,
  searchParams,
}: PageProps<'/[locale]/notices/[announcementId]'>) {
  return (
    <ModuleGuard module="notices">
      <Suspense fallback={<StaffPageSkeleton />}>
        <AnnouncementDetails params={params} searchParams={searchParams} />
      </Suspense>
    </ModuleGuard>
  );
}

async function AnnouncementDetails({
  params,
  searchParams,
}: {
  params: PageProps<'/[locale]/notices/[announcementId]'>['params'];
  searchParams: PageProps<'/[locale]/notices/[announcementId]'>['searchParams'];
}) {
  const [{ announcementId }, query, workspace, locale, t] = await Promise.all([
    params,
    searchParams,
    getNoticeWorkspace(),
    getLocale(),
    getTranslator(),
  ]);
  const { staff, client, municipalityId, departments } = workspace;
  const back = (
    <ButtonLink
      href={localizedHref(locale, '/notices')}
      variant="ghost"
      size="sm"
      icon="chevronEnd"
      className="mb-3 [&>svg]:rotate-180"
    >
      {t('adminNotices.form.backToList')}
    </ButtonLink>
  );

  // Explicitly scoped to the active municipality (and by RLS).
  const [announcement, neighborhoods] = await Promise.all([
    UUID.test(announcementId)
      ? getStaffAnnouncement(client, {
          municipalityId,
          announcementId: announcementId.toLowerCase(),
        })
      : null,
    listNeighborhoods(client, { municipalityId }),
  ]);
  if (!announcement) {
    return (
      <>
        {back}
        <Panel>
          <EmptyState
            icon="notices"
            title={t('adminNotices.detail.notFoundTitle')}
            description={t('adminNotices.detail.notFoundDescription')}
          />
        </Panel>
      </>
    );
  }

  const role = staff.active.role;
  const ownDepartment = staff.active.department_id;
  const editable = canEditAnnouncement(role, ownDepartment, announcement);
  const state = announcementDisplayState(announcement);
  const department = announcement.department_id
    ? departments.find((d) => d.id === announcement.department_id)
    : undefined;
  const departmentName = department
    ? localizedText(department.name, locale)
    : t('adminNotices.municipalityWide');
  const neighborhoodOptions = neighborhoods.map((n) => ({
    id: n.id,
    name: localizedText(n.name, locale),
  }));
  const imageUrl = announcement.image_path
    ? await signAnnouncementImage(client, { path: announcement.image_path })
    : null;

  return (
    <>
      {back}
      <PageHeader
        title={
          editable ? t('adminNotices.form.editTitle') : localizedText(announcement.title, locale)
        }
        meta={
          <Badge tone={state === 'live' ? 'success' : 'neutral'} dot>
            {t(`adminNotices.state.${state}`)}
          </Badge>
        }
        actions={
          announcement.status === 'draft' &&
          canDeleteDraft(role, ownDepartment, announcement.department_id) ? (
            <ConfirmActionForm
              action={deleteAnnouncementAction}
              fields={{ locale, announcementId: announcement.id, redirect: 'list' }}
              variant="ghost"
              size="sm"
              label={t('adminNotices.actions.delete')}
              pendingLabel={t('adminNotices.actions.deleting')}
              confirmTitle={t('adminNotices.actions.confirmDeleteTitle')}
              confirmBody={t('adminNotices.actions.confirmDelete')}
              confirmLabel={t('adminNotices.actions.delete')}
              cancelLabel={t('adminNotices.actions.cancel')}
              danger
            />
          ) : null
        }
      />
      {query.image === 'not-public' && announcement.status === 'published' ? (
        <div className="mb-4">
          <Alert tone="warning">{t('adminNotices.imageNotPublic')}</Alert>
        </div>
      ) : null}
      <Panel>
        {editable ? (
          <AnnouncementForm
            locale={locale}
            strings={noticeStrings(locale)}
            departments={null}
            neighborhoods={neighborhoodOptions}
            ownDepartmentName={null}
            canPublishOwn={false}
            announcement={{
              id: announcement.id,
              title: announcement.title,
              body: announcement.body,
              severity: announcement.severity,
              neighborhoodId: announcement.neighborhood_id,
              expiresAt: announcement.expires_at,
              departmentName,
              published: announcement.status === 'published',
              imageUrl,
              hasImage: announcement.image_path !== null,
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Alert tone="info">{t('adminNotices.detail.readOnly')}</Alert>
            <p className="text-sm text-muted">
              {departmentName}
              {announcement.neighborhood_id
                ? ` · ${t('adminNotices.neighborhoodLabel', {
                    name:
                      neighborhoodOptions.find((n) => n.id === announcement.neighborhood_id)
                        ?.name ?? '—',
                  })}`
                : ''}
            </p>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              <img
                src={imageUrl}
                alt=""
                className="max-h-72 w-fit max-w-full rounded-md border border-border object-contain"
              />
            ) : null}
            <p className="text-base whitespace-pre-line text-foreground">
              {localizedText(announcement.body, locale)}
            </p>
          </div>
        )}
      </Panel>
    </>
  );
}
