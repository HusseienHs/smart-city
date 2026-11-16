import {
  ASSIGNABLE_STAFF_ROLES,
  getMunicipalityWorkflowSettings,
  getStaffReport,
  getStaffReportSummary,
  MAX_COMPLETION_PHOTOS,
  signReportAttachments,
  type SignedReportMedia,
  type StaffReportDetails,
} from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { ReportPriorityBadge } from '@/components/reports/report-priority-badge';
import { REPORT_STATUS_TONES, ReportStatusBadge } from '@/components/report-status-badge';
import { AssignmentForm } from '@/components/reports/detail/assignment-form';
import { CommentForm } from '@/components/reports/detail/comment-form';
import { CompletionUpload } from '@/components/reports/detail/completion-upload';
import {
  ReportComments,
  ReportFacts,
  ReportHistory,
  ReportPhotos,
} from '@/components/reports/detail/report-sections';
import { ReporterContact } from '@/components/reports/detail/reporter-contact';
import { StatusForm } from '@/components/reports/detail/status-form';
import { Alert } from '@/components/ui/alert';
import { Badge, badgeDotClass } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { BackLink } from '@/components/ui/page-header';
import { IconTile, Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import {
  assignmentMode,
  canEditAssignment,
  canReturnToIntake,
  canViewReporterContact,
  completionUpload,
  isFinishedStatus,
  statusTargets,
} from '@/lib/reports/capabilities';
import { formatDateTime } from '@/lib/reports/format';
import { reportLabels } from '@/lib/reports/labels';
import { reportStrings } from '@/lib/reports/strings';
import { getReportsWorkspace } from '@/lib/reports/workspace';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateMetadata() {
  return moduleMetadata('reports');
}

export default function ReportDetailsPage({ params }: PageProps<'/[locale]/reports/[reportId]'>) {
  return (
    <ModuleGuard module="reports">
      <Suspense fallback={<ReportDetailsSkeleton />}>
        <ReportDetails params={params} />
      </Suspense>
    </ModuleGuard>
  );
}

async function ReportDetails({
  params,
}: {
  params: PageProps<'/[locale]/reports/[reportId]'>['params'];
}) {
  const [{ reportId }, workspace, locale, t] = await Promise.all([
    params,
    getReportsWorkspace(),
    getLocale(),
    getTranslator(),
  ]);
  const { staff, municipalityId, client, directory, colleagues } = workspace;
  const listHref = localizedHref(locale, '/reports');
  const back = { href: listHref, label: t('adminReports.detail.backToList') };

  let details: StaffReportDetails | null = null;
  let failed = false;
  if (UUID.test(reportId)) {
    try {
      details = await getStaffReport(client, { municipalityId, reportId });
    } catch (error) {
      failed = true;
      console.error('[reports] details failed', error instanceof Error ? error.name : 'unknown');
    }
  }

  if (!details) {
    // Missing, foreign and inaccessible reports look the same (no id probing).
    return (
      <>
        <BackLink {...back} className="mb-4" />
        <Panel>
          <EmptyState
            icon={failed ? 'alert' : 'reports'}
            title={
              failed
                ? t('adminReports.detail.loadErrorTitle')
                : t('adminReports.detail.notFoundTitle')
            }
            description={
              failed
                ? t('adminReports.list.loadErrorDescription')
                : t('adminReports.detail.notFoundDescription')
            }
          >
            {failed ? (
              <ButtonLink href={localizedHref(locale, `/reports/${reportId}`)} variant="primary">
                {t('common.retry')}
              </ButtonLink>
            ) : null}
            <ButtonLink href={listHref} variant="secondary">
              {t('adminReports.detail.backToList')}
            </ButtonLink>
          </EmptyState>
        </Panel>
      </>
    );
  }

  const { report, attachments, comments, history } = details;
  const role = staff.active.role;
  const labels = reportLabels(directory, colleagues, locale, t);
  const strings = reportStrings(locale);

  const [signed, settings, duplicate] = await Promise.all([
    // Signed per request, never cached. A storage failure only hides the photos.
    signReportAttachments(client, attachments).catch((): SignedReportMedia[] => []),
    getMunicipalityWorkflowSettings(client, { municipalityId }).catch(() => ({
      requireCompletionPhoto: false,
    })),
    report.duplicate_of_id
      ? getStaffReportSummary(client, { municipalityId, reportId: report.duplicate_of_id }).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);
  const media = new Map(signed.map((item) => [item.attachmentId, item]));
  const citizenPhotos = attachments.filter((a) => a.kind === 'citizen_photo');
  const completionPhotos = attachments.filter((a) => a.kind === 'completion_photo');

  const targets = statusTargets(role, report);
  // 'none' = read-only: employees, and finished reports for everyone.
  const mode = canEditAssignment(role, report.status) ? assignmentMode(role) : 'none';
  const upload = completionUpload(role, report.status, completionPhotos.length);

  const departmentOptions = directory.departments
    .filter((d) => d.isActive)
    .filter((d) => mode !== 'department' || d.id === staff.active.department_id)
    .map((d) => ({ id: d.id, label: localizedText(d.name, locale) }));
  const assigneeOptions = colleagues
    .filter(
      (c) =>
        (ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(c.role) && c.department_id !== null,
    )
    .map((c) => ({
      id: c.employee_id,
      departmentId: c.department_id!,
      label: c.full_name?.trim() || t('adminReports.people.unnamedStaff'),
    }));

  return (
    <>
      <BackLink {...back} className="mb-4" />

      {/* Masthead: the report's identity, state and the facts staff look for first. */}
      <header className="relative mb-6 animate-enter overflow-hidden card">
        <div
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-0 h-1',
            badgeDotClass(REPORT_STATUS_TONES[report.status]),
          )}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 px-5 pt-6 pb-5 sm:px-6">
          <div className="min-w-0 flex-1 basis-96">
            <p className="flex items-center gap-2 eyebrow text-muted">
              <Icon name="tag" className="size-3.5" />
              {labels.category(report.category_id)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1
                dir="ltr"
                className="font-mono text-2xl leading-9 font-semibold tracking-tight text-foreground sm:text-3xl"
              >
                {report.tracking_number}
              </h1>
              <ReportStatusBadge
                status={report.status}
                label={t(`reportStatus.${report.status}`)}
              />
            </div>
            <p
              className="mt-3 line-clamp-2 max-w-3xl text-md leading-6 text-foreground-secondary"
              dir="auto"
            >
              {report.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 ring-1 ring-border ring-inset">
            <ReportPriorityBadge
              priority={report.priority}
              label={t(`reportPriority.${report.priority}`)}
            />
          </div>
        </div>
        <dl className="grid border-t border-border bg-surface-subtle sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: 'departments' as const,
              label: t('adminReports.assignment.department'),
              value: labels.department(report.department_id),
            },
            {
              icon: 'user' as const,
              label: t('adminReports.assignment.assignee'),
              value: labels.person(report.assignee_id),
            },
            {
              icon: 'clock' as const,
              label: t('adminReports.detail.submittedAt'),
              value: formatDateTime(locale, report.created_at),
            },
            {
              icon: 'layers' as const,
              label: t('adminReports.detail.statusChangedAt'),
              value: formatDateTime(locale, report.status_changed_at),
            },
          ].map((fact, index) => (
            <div
              key={fact.label}
              className={cn(
                'flex items-center gap-3 px-5 py-3.5 sm:px-6',
                index > 0 && 'border-border max-sm:border-t',
                index % 2 === 1 && 'sm:border-s',
                index >= 2 && 'sm:max-xl:border-t',
                index === 2 && 'xl:border-s',
              )}
            >
              <IconTile icon={fact.icon} size="sm" />
              <div className="min-w-0">
                <dt className="text-xs text-muted">{fact.label}</dt>
                <dd className="truncate text-sm font-semibold text-foreground tabular-nums">
                  {fact.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 animate-enter flex-col gap-6">
          <Panel title={t('adminReports.detail.details')} icon="reports">
            <ReportFacts
              report={report}
              duplicateOf={
                duplicate
                  ? {
                      href: localizedHref(locale, `/reports/${duplicate.id}`),
                      label: duplicate.tracking_number,
                    }
                  : null
              }
              labels={labels}
              locale={locale}
              t={t}
            />
          </Panel>

          <Panel
            title={t('adminReports.detail.photos')}
            description={t('adminReports.detail.linksExpire')}
            icon="image"
          >
            <div className="flex flex-col gap-6">
              <ReportPhotos
                title={t('adminReports.detail.citizenPhotos')}
                attachments={citizenPhotos}
                media={media}
                trackingNumber={report.tracking_number}
                t={t}
              />
              <ReportPhotos
                title={t('adminReports.detail.completionPhotos')}
                attachments={completionPhotos}
                media={media}
                trackingNumber={report.tracking_number}
                t={t}
              />
            </div>
          </Panel>

          <Panel
            title={t('adminReports.comments.title')}
            icon="message"
            actions={
              <Badge size="sm" className="tabular-nums">
                {comments.length}
              </Badge>
            }
          >
            <div className="flex flex-col gap-6">
              <ReportComments comments={comments} labels={labels} locale={locale} t={t} />
              <div className="-mx-5 -mb-5 border-t border-border bg-surface-subtle px-5 pt-4 pb-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  {t('adminReports.comments.add')}
                </h3>
                <CommentForm locale={locale} reportId={report.id} strings={strings} />
              </div>
            </div>
          </Panel>

          <Panel title={t('adminReports.detail.history')} icon="clock">
            <ReportHistory history={history} labels={labels} locale={locale} t={t} />
          </Panel>
        </div>

        {/* The action column stays in view while the record scrolls (desktop). */}
        <aside className="flex min-w-0 animate-enter flex-col gap-6 [animation-delay:80ms] xl:sticky xl:top-[calc(var(--header-height)+1.5rem)]">
          <Panel title={t('adminReports.status.title')} icon="layers">
            <div className="flex flex-col gap-3">
              {role === 'intake_dispatcher' && targets.length > 0 ? (
                <p className="text-sm text-muted">{t('adminReports.status.dispatcherHint')}</p>
              ) : null}
              {report.department_id === null &&
              role !== 'intake_dispatcher' &&
              (report.status === 'submitted' || report.status === 'under_review') ? (
                <p className="text-sm text-muted">{t('adminReports.status.routeFirst')}</p>
              ) : null}
              {isFinishedStatus(report.status) && targets.length === 0 ? (
                <p className="text-sm text-muted">{t('adminReports.status.finished')}</p>
              ) : targets.length === 0 ? (
                <p className="text-sm text-muted">{t('adminReports.status.noActions')}</p>
              ) : (
                <StatusForm
                  locale={locale}
                  reportId={report.id}
                  strings={strings}
                  targets={targets}
                  completionPhotoMissing={
                    settings.requireCompletionPhoto && completionPhotos.length === 0
                  }
                />
              )}
            </div>
          </Panel>

          <Panel title={t('adminReports.assignment.title')} icon="userPlus">
            {mode !== 'none' ? (
              <AssignmentForm
                locale={locale}
                reportId={report.id}
                strings={strings}
                mode={mode}
                current={{
                  departmentId: report.department_id,
                  assigneeId: report.assignee_id,
                  priority: report.priority,
                }}
                departments={departmentOptions}
                assignees={assigneeOptions}
                intakeAllowed={canReturnToIntake(role, report.status)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <DescriptionList
                  items={[
                    {
                      label: t('adminReports.assignment.department'),
                      value: labels.department(report.department_id),
                      icon: 'departments',
                    },
                    {
                      label: t('adminReports.assignment.assignee'),
                      value: labels.person(report.assignee_id),
                      icon: 'user',
                    },
                    {
                      label: t('adminReports.assignment.priority'),
                      value: (
                        <ReportPriorityBadge
                          priority={report.priority}
                          label={t(`reportPriority.${report.priority}`)}
                        />
                      ),
                      icon: 'flag',
                    },
                  ]}
                />
                <p className="border-t border-border pt-3 text-sm text-muted">
                  {isFinishedStatus(report.status)
                    ? t('adminReports.assignment.finished')
                    : t('adminReports.assignment.readOnly')}
                </p>
              </div>
            )}
          </Panel>

          <Panel title={t('adminReports.contact.title')} icon="user">
            {canViewReporterContact(role) ? (
              <ReporterContact locale={locale} reportId={report.id} strings={strings} />
            ) : (
              <p className="text-sm text-muted">{t('adminReports.contact.dispatcher')}</p>
            )}
          </Panel>

          <Panel title={t('adminReports.completion.title')} icon="upload">
            {upload.allowed ? (
              <CompletionUpload
                locale={locale}
                reportId={report.id}
                municipalityId={municipalityId}
                strings={strings}
                existing={completionPhotos.length}
              />
            ) : (
              <Alert tone="info">
                {upload.reason === 'role'
                  ? t('adminReports.completion.notHandler')
                  : upload.reason === 'limit'
                    ? t('adminReports.completion.limitReached', { max: MAX_COMPLETION_PHOTOS })
                    : t('adminReports.completion.statusHint')}
              </Alert>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function ReportDetailsSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-4 h-7 w-32 rounded-full" />
      <div className="mb-6 card">
        <div className="flex flex-col gap-3 px-6 pt-6 pb-5">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="h-16 rounded-b-xl border-t border-border bg-surface-subtle" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-6">
          {['h-40', 'h-56', 'h-48'].map((height) => (
            <div key={height} className="card">
              <div className="border-b border-border px-5 py-4">
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="p-5">
                <Skeleton className={`${height} w-full rounded-md`} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="border-b border-border px-5 py-4">
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
