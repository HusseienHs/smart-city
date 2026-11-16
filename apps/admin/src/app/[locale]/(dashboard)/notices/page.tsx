import { listNeighborhoods, listStaffAnnouncements, type StaffAnnouncement } from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import type { Translator } from '@smart-city/shared/i18n';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { ConfirmActionForm } from '@/components/staff/confirm-action-form';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import type { AccessRole } from '@/lib/auth/permissions';
import { requireStaff } from '@/lib/auth/staff-context';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { deleteAnnouncementAction, setAnnouncementStatusAction } from '@/lib/notices/actions';
import {
  announcementDisplayState,
  canDeleteDraft,
  canDraftAnnouncements,
  canPublishAnnouncement,
  type AnnouncementDisplayState,
} from '@/lib/notices/capabilities';
import { formatDateTime } from '@/lib/reports/format';
import { getNoticeWorkspace } from '@/lib/notices/workspace';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export function generateMetadata() {
  return moduleMetadata('notices');
}

export default function NoticesPage() {
  return (
    <ModuleGuard module="notices">
      <Suspense fallback={<StaffPageSkeleton />}>
        <NoticesList />
      </Suspense>
    </ModuleGuard>
  );
}

const SEVERITY_TONE: Record<StaffAnnouncement['severity'], BadgeTone> = {
  info: 'info',
  important: 'warning',
  emergency: 'danger',
};

const STATE_TONE: Record<AnnouncementDisplayState, BadgeTone> = {
  draft: 'neutral',
  live: 'success',
  expired: 'warning',
  archived: 'neutral',
};

async function NoticesList() {
  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);
  let workspace;
  let announcements: StaffAnnouncement[];
  let neighborhoodNames: Map<string, string>;
  // Resolved (and cached for this request) by ModuleGuard already; it redirects or 404s outside
  // the try so those control-flow errors aren't reported as a load failure.
  const staff = await requireStaff();
  if (!staff.active) notFound();
  try {
    const scope = { municipalityId: staff.active.municipality_id };
    const client = await createSupabaseServerClient();
    // One round trip instead of two: the departments load alongside the list.
    const [loaded, items, neighborhoods] = await Promise.all([
      getNoticeWorkspace(),
      listStaffAnnouncements(client, scope),
      listNeighborhoods(client, scope).catch(() => []),
    ]);
    workspace = loaded;
    announcements = items;
    neighborhoodNames = new Map(neighborhoods.map((n) => [n.id, localizedText(n.name, locale)]));
  } catch (error) {
    console.error('[notices] load failed', error instanceof Error ? error.name : 'unknown');
    return (
      <>
        <PageHeader title={t('adminNav.notices')} />
        <Panel>
          <EmptyState icon="alert" title={t('adminNotices.loadError')}>
            <ButtonLink href={localizedHref(locale, '/notices')} variant="primary">
              {t('common.retry')}
            </ButtonLink>
          </EmptyState>
        </Panel>
      </>
    );
  }

  const { departments } = workspace;
  const role = staff.active.role;
  const ownDepartment = staff.active.department_id;
  const canCreate = canDraftAnnouncements(role, ownDepartment);
  const departmentNames = new Map(departments.map((d) => [d.id, localizedText(d.name, locale)]));

  return (
    <>
      <PageHeader
        title={t('adminNav.notices')}
        description={t('adminNotices.subtitle')}
        meta={<Badge tone="primary">{localizedText(staff.active.municipality_name, locale)}</Badge>}
        actions={
          canCreate ? (
            <ButtonLink href={localizedHref(locale, '/notices/new')} variant="primary" icon="plus">
              {t('adminNotices.newAnnouncement')}
            </ButtonLink>
          ) : null
        }
      />
      <Panel title={t('adminNotices.listTitle')} flush>
        {announcements.length === 0 ? (
          <EmptyState
            icon="notices"
            title={t('adminNotices.empty')}
            description={canCreate ? t('adminNotices.emptyDescription') : undefined}
          />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>{t('adminNotices.columns.title')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNotices.columns.scope')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNotices.columns.severity')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNotices.columns.status')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNotices.columns.date')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNotices.columns.actions')}</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {announcements.map((item) => {
                const state = announcementDisplayState(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-md">
                      <Link
                        href={localizedHref(locale, `/notices/${item.id}`)}
                        className="block font-medium text-accent hover:underline"
                      >
                        {localizedText(item.title, locale)}
                      </Link>
                      <span className="line-clamp-2 block text-sm text-muted">
                        {localizedText(item.body, locale)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground-secondary">
                      {item.department_id
                        ? (departmentNames.get(item.department_id) ?? '—')
                        : t('adminNotices.municipalityWide')}
                      {item.neighborhood_id ? (
                        <span className="block text-xs text-muted">
                          {t('adminNotices.neighborhoodLabel', {
                            name: neighborhoodNames.get(item.neighborhood_id) ?? '—',
                          })}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge tone={SEVERITY_TONE[item.severity]}>
                        {t(`notices.severity.${item.severity}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATE_TONE[state]} dot>
                        {t(`adminNotices.state.${state}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-foreground-secondary">
                      <span className="block">
                        {item.published_at
                          ? t('adminNotices.publishedOn', {
                              date: formatDateTime(locale, item.published_at),
                            })
                          : t('adminNotices.createdOn', {
                              date: formatDateTime(locale, item.created_at),
                            })}
                      </span>
                      {item.expires_at ? (
                        <span className="block text-muted">
                          {t('adminNotices.expiresOn', {
                            date: formatDateTime(locale, item.expires_at),
                          })}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        item={item}
                        role={role}
                        ownDepartment={ownDepartment}
                        locale={locale}
                        t={t}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

function RowActions({
  item,
  role,
  ownDepartment,
  locale,
  t,
}: {
  item: StaffAnnouncement;
  role: AccessRole;
  ownDepartment: string | null;
  locale: Locale;
  t: Translator;
}) {
  const publisher = canPublishAnnouncement(role, ownDepartment, item.department_id);
  const deletable =
    item.status === 'draft' && canDeleteDraft(role, ownDepartment, item.department_id);
  const common = {
    size: 'sm' as const,
    cancelLabel: t('adminNotices.actions.cancel'),
  };
  return (
    <div className="flex flex-wrap items-start gap-2">
      {publisher && item.status === 'draft' ? (
        <ConfirmActionForm
          {...common}
          action={setAnnouncementStatusAction}
          fields={{ locale, announcementId: item.id, status: 'published' }}
          variant="primary"
          label={t('adminNotices.actions.publish')}
          pendingLabel={t('adminNotices.actions.publishing')}
          confirmTitle={t('adminNotices.actions.confirmPublishTitle')}
          confirmBody={t('adminNotices.actions.confirmPublish')}
          confirmLabel={t('adminNotices.actions.publish')}
        />
      ) : null}
      {publisher && item.status === 'published' ? (
        <ConfirmActionForm
          {...common}
          action={setAnnouncementStatusAction}
          fields={{ locale, announcementId: item.id, status: 'archived' }}
          label={t('adminNotices.actions.archive')}
          pendingLabel={t('adminNotices.actions.archiving')}
          confirmTitle={t('adminNotices.actions.confirmArchiveTitle')}
          confirmBody={t('adminNotices.actions.confirmArchive')}
          confirmLabel={t('adminNotices.actions.archive')}
          danger
        />
      ) : null}
      {deletable ? (
        <ConfirmActionForm
          {...common}
          action={deleteAnnouncementAction}
          fields={{ locale, announcementId: item.id }}
          variant="ghost"
          label={t('adminNotices.actions.delete')}
          pendingLabel={t('adminNotices.actions.deleting')}
          confirmTitle={t('adminNotices.actions.confirmDeleteTitle')}
          confirmBody={t('adminNotices.actions.confirmDelete')}
          confirmLabel={t('adminNotices.actions.delete')}
          danger
        />
      ) : null}
    </div>
  );
}
