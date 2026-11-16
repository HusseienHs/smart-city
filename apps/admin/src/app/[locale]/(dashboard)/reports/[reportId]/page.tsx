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
import { ReportStatusBadge } from '@/components/report-status-badge';
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
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { EmptyState } from '@/components/ui/empty-state';
import { BackLink, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
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
      <PageHeader
        back={back}
        title={report.tracking_number}
        description={labels.category(report.category_id)}
        meta={
          <>
            <ReportStatusBadge status={report.status} label={t(`reportStatus.${report.status}`)} />
            <ReportPriorityBadge
              priority={report.priority}
              label={t(`reportPriority.${report.priority}`)}
            />
            <Badge>{labels.department(report.department_id)}</Badge>
          </>
        }
      />

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

        <aside className="flex min-w-0 animate-enter flex-col gap-6">
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
      <Skeleton className="mb-4 h-4 w-28" />
      <div className="mb-7 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-6 w-20 rounded-sm" />
          <Skeleton className="h-6 w-16 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-32" />
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
                <Skeleton className="h-9 w-full rounded-sm" />
                <Skeleton className="h-9 w-full rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
