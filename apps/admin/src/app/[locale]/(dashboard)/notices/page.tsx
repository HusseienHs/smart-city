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
import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader, StatStrip } from '@/components/ui/page-header';
import { IconTile, Panel } from '@/components/ui/panel';
import type { AccessRole } from '@/lib/auth/permissions';
import { requireStaff } from '@/lib/auth/staff-context';
import { cn } from '@/lib/cn';
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

/** The marker beside each title: severity at a glance, before reading the badge. */
const SEVERITY_ICON: Record<StaffAnnouncement['severity'], { icon: IconName; box: string }> = {
  info: { icon: 'info', box: 'border-info-border bg-info-soft text-info' },
  important: { icon: 'alert', box: 'border-warning-border bg-warning-soft text-warning' },
  emergency: { icon: 'alert', box: 'border-danger-border bg-danger-soft text-danger' },
};

const STATE_TONE: Record<AnnouncementDisplayState, BadgeTone> = {
  draft: 'neutral',
  live: 'success',
  expired: 'warning',
  archived: 'neutral',
};

const SEVERITY_STRIPE: Record<StaffAnnouncement['severity'], string> = {
  info: 'bg-info',
  important: 'bg-warning',
  emergency: 'bg-danger',
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
        eyebrow={localizedText(staff.active.municipality_name, locale)}
        title={t('adminNav.notices')}
        description={t('adminNotices.subtitle')}
        actions={
          canCreate ? (
            <ButtonLink href={localizedHref(locale, '/notices/new')} variant="primary" icon="plus">
              {t('adminNotices.newAnnouncement')}
            </ButtonLink>
          ) : null
        }
      />
      {/* The board at a glance: counted from the announcements loaded below. */}
      <div className="mb-6 animate-enter">
        <StatStrip
          items={(['live', 'draft', 'expired', 'archived'] as const).map((state) => ({
            label: t(`adminNotices.state.${state}`),
            value: announcements.filter((item) => announcementDisplayState(item) === state).length,
          }))}
        />
      </div>

      <section
        aria-labelledby="notices-feed"
        className="animate-enter overflow-hidden card [animation-delay:60ms]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <IconTile icon="notices" tone="primary" />
            <h2 id="notices-feed" className="text-md font-semibold tracking-tight text-foreground">
              {t('adminNotices.listTitle')}
            </h2>
          </div>
          {announcements.length > 0 ? (
            <Badge size="sm" className="tabular-nums">
              {announcements.length}
            </Badge>
          ) : null}
        </header>
        {announcements.length === 0 ? (
          <EmptyState
            icon="notices"
            title={t('adminNotices.empty')}
            description={canCreate ? t('adminNotices.emptyDescription') : undefined}
          >
            {canCreate ? (
              <ButtonLink
                href={localizedHref(locale, '/notices/new')}
                variant="primary"
                icon="plus"
              >
                {t('adminNotices.newAnnouncement')}
              </ButtonLink>
            ) : null}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {announcements.map((item) => {
              const state = announcementDisplayState(item);
              return (
                <li
                  key={item.id}
                  className="group relative grid gap-4 px-5 py-5 transition-colors hover:bg-surface-subtle lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-start"
                >
                  {/* The severity, as a stripe on the start edge. */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-y-4 start-0 w-1 rounded-e-full',
                      SEVERITY_STRIPE[item.severity],
                    )}
                  />
                  <div className="flex min-w-0 gap-4">
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl border',
                        SEVERITY_ICON[item.severity].box,
                      )}
                    >
                      <Icon name={SEVERITY_ICON[item.severity].icon} className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATE_TONE[state]} dot size="sm">
                          {t(`adminNotices.state.${state}`)}
                        </Badge>
                        <Badge tone={SEVERITY_TONE[item.severity]} size="sm">
                          {t(`notices.severity.${item.severity}`)}
                        </Badge>
                      </div>
                      <Link
                        href={localizedHref(locale, `/notices/${item.id}`)}
                        className="mt-2 block text-md font-semibold tracking-tight text-foreground transition-colors hover:text-accent"
                      >
                        {localizedText(item.title, locale)}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                        {localizedText(item.body, locale)}
                      </p>
                      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="departments" className="size-3.5" />
                          {item.department_id
                            ? (departmentNames.get(item.department_id) ?? '—')
                            : t('adminNotices.municipalityWide')}
                        </span>
                        {item.neighborhood_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="mapPin" className="size-3.5" />
                            {t('adminNotices.neighborhoodLabel', {
                              name: neighborhoodNames.get(item.neighborhood_id) ?? '—',
                            })}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-foreground-secondary tabular-nums max-lg:ps-14">
                    <span className="flex items-center gap-1.5">
                      <Icon name="calendar" className="size-3.5 text-subtle" />
                      {item.published_at
                        ? t('adminNotices.publishedOn', {
                            date: formatDateTime(locale, item.published_at),
                          })
                        : t('adminNotices.createdOn', {
                            date: formatDateTime(locale, item.created_at),
                          })}
                    </span>
                    {item.expires_at ? (
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <Icon name="clock" className="size-3.5 text-subtle" />
                        {t('adminNotices.expiresOn', {
                          date: formatDateTime(locale, item.expires_at),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <div className="max-lg:ps-14">
                    <RowActions
                      item={item}
                      role={role}
                      ownDepartment={ownDepartment}
                      locale={locale}
                      t={t}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
