import type {
  SignedReportMedia,
  StaffReport,
  StaffReportAttachment,
  StaffReportComment,
  StaffReportHistoryEntry,
} from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import type { Translator } from '@smart-city/shared/i18n';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { REPORT_STATUS_TONES, ReportStatusBadge } from '@/components/report-status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge, badgeDotClass } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { formatCoordinate, formatDateTime } from '@/lib/reports/format';
import type { ReportLabels } from '@/lib/reports/labels';

function Fact({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted ring-1 ring-border ring-inset">
        <Icon name={icon} className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium break-words text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** Everything known about the report, including the exact location (staff only). */
export function ReportFacts({
  report,
  duplicateOf,
  labels,
  locale,
  t,
}: {
  report: StaffReport;
  /** Link to the original report when this one was rejected as a duplicate. */
  duplicateOf: { href: string; label: string } | null;
  labels: ReportLabels;
  locale: Locale;
  t: Translator;
}) {
  const neighborhood = labels.neighborhood(report.neighborhood_id);
  const location = report.location;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2.5 eyebrow text-muted">{t('adminReports.detail.description')}</h3>
        <p
          className="relative rounded-xl bg-surface-subtle py-4 ps-5 pe-4 text-md leading-7 whitespace-pre-line text-foreground ring-1 ring-border ring-inset before:absolute before:inset-y-3 before:start-0 before:w-1 before:rounded-e-full before:bg-primary"
          dir="auto"
        >
          {report.description}
        </p>
      </div>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Fact icon="tag" label={t('adminReports.columns.category')}>
          {labels.category(report.category_id)}
        </Fact>
        <Fact icon="eye" label={t('adminReports.detail.visibility')}>
          {report.visibility === 'public'
            ? t('adminReports.detail.visibilityPublic')
            : t('adminReports.detail.visibilityPrivate')}
        </Fact>
        <Fact icon="mapPin" label={t('adminReports.detail.address')}>
          <span dir="auto">{report.address?.trim() || '—'}</span>
        </Fact>
        <Fact icon="map" label={t('adminReports.detail.neighborhood')}>
          {neighborhood ?? '—'}
        </Fact>
        <Fact icon="mapPin" label={t('adminReports.detail.location')}>
          {location ? (
            <span className="flex flex-col gap-1">
              <span dir="ltr" className="font-mono text-xs text-foreground-secondary">
                {formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}
              </span>
              {report.location_accuracy_m != null ? (
                <span className="text-xs text-muted">
                  {t('adminReports.detail.accuracy', {
                    meters: Math.round(report.location_accuracy_m),
                  })}
                </span>
              ) : null}
              <a
                href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=18/${location.latitude}/${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                {t('adminReports.detail.openInMap')}
                <Icon name="arrowEnd" className="size-3.5 -rotate-45 rtl:rotate-45" />
              </a>
            </span>
          ) : (
            <span className="text-muted">{t('adminReports.detail.noLocation')}</span>
          )}
        </Fact>
        <Fact icon="checkCircle" label={t('adminReports.detail.confirmations')}>
          <span className="tabular-nums">
            {report.confirmation_count} · {t('adminReports.detail.followers')}{' '}
            {report.follower_count}
          </span>
        </Fact>
        <Fact icon="clock" label={t('adminReports.detail.submittedAt')}>
          <span className="tabular-nums">{formatDateTime(locale, report.created_at)}</span>
        </Fact>
        <Fact icon="clock" label={t('adminReports.detail.updatedAt')}>
          <span className="tabular-nums">{formatDateTime(locale, report.updated_at)}</span>
        </Fact>
        <Fact icon="layers" label={t('adminReports.detail.statusChangedAt')}>
          <span className="tabular-nums">{formatDateTime(locale, report.status_changed_at)}</span>
        </Fact>
        {report.rejection_reason ? (
          <Fact icon="alert" label={t('adminReports.detail.rejectionReason')}>
            {t(`reportRejectionReason.${report.rejection_reason}`)}
          </Fact>
        ) : null}
        {duplicateOf ? (
          <Fact icon="copy" label={t('adminReports.detail.duplicateOf')}>
            <Link
              href={duplicateOf.href}
              className="font-medium text-accent tabular-nums hover:underline"
              dir="ltr"
            >
              {duplicateOf.label}
            </Link>
          </Fact>
        ) : null}
      </dl>
    </div>
  );
}

/**
 * Photos through short-lived signed URLs (created for this request only). HEIC can't be shown
 * by most browsers, so it is offered as a download. Links never send a Referer.
 */
export function ReportPhotos({
  title,
  attachments,
  media,
  trackingNumber,
  t,
}: {
  title: string;
  attachments: readonly StaffReportAttachment[];
  media: ReadonlyMap<string, SignedReportMedia>;
  trackingNumber: string;
  t: Translator;
}) {
  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
        {title}
        <span className="rounded-full bg-surface-muted px-2 text-2xs leading-5 text-muted tabular-nums">
          {attachments.length}
        </span>
      </h3>
      {attachments.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-5 text-sm text-muted">
          <Icon name="image" className="size-4 text-subtle" />
          {t('adminReports.detail.noPhotos')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {attachments.map((attachment, index) => {
            const signed = media.get(attachment.id);
            const alt = t('adminReports.detail.photoAlt', { index: index + 1, trackingNumber });
            return (
              <li
                key={attachment.id}
                className="group overflow-hidden rounded-xl bg-surface-subtle shadow-xs ring-1 ring-border"
              >
                {signed?.viewUrl && signed.displayable ? (
                  <a
                    href={signed.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="block overflow-hidden focus-visible:ring-4 focus-visible:ring-focus-ring focus-visible:outline-none focus-visible:ring-inset"
                  >
                    {/* Signed, expiring URLs from a private bucket: not suitable for next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signed.viewUrl}
                      alt={alt}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="aspect-square w-full object-cover transition-transform duration-300 ease-standard group-hover:scale-[1.03]"
                    />
                  </a>
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center">
                    <Icon name={signed?.downloadUrl ? 'image' : 'alert'} className="text-subtle" />
                    <span className="text-xs text-muted">
                      {signed?.downloadUrl
                        ? t('adminReports.detail.heicPhoto')
                        : t('adminReports.detail.photoUnavailable')}
                    </span>
                  </div>
                )}
                {signed?.downloadUrl ? (
                  <a
                    href={signed.downloadUrl}
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="flex items-center justify-center gap-1.5 border-t border-border bg-surface px-2 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-surface-muted"
                  >
                    <Icon name="arrowDown" className="size-3.5" />
                    {t('adminReports.detail.download')}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Status changes, oldest first, with their notes (internal or public). */
export function ReportHistory({
  history,
  labels,
  locale,
  t,
}: {
  history: readonly StaffReportHistoryEntry[];
  labels: ReportLabels;
  locale: Locale;
  t: Translator;
}) {
  return (
    <ol className="relative flex flex-col gap-6">
      {history.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3.5">
          {/* The rail that joins one step to the next. */}
          {index < history.length - 1 ? (
            <span
              aria-hidden
              className="absolute start-[11px] top-7 -bottom-6 w-px bg-gradient-to-b from-border-strong to-border"
            />
          ) : null}
          <span
            aria-hidden
            className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface shadow-xs ring-1 ring-border-strong"
          >
            <span
              className={cn(
                'size-2 rounded-full',
                badgeDotClass(REPORT_STATUS_TONES[entry.to_status]),
              )}
            />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {entry.from_status ? (
                <>
                  <ReportStatusBadge
                    status={entry.from_status}
                    label={t(`reportStatus.${entry.from_status}`)}
                  />
                  <Icon name="arrowEnd" className="size-3.5 text-subtle" />
                </>
              ) : null}
              <ReportStatusBadge
                status={entry.to_status}
                label={t(`reportStatus.${entry.to_status}`)}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              <span className="tabular-nums">{formatDateTime(locale, entry.created_at)}</span>
              {' · '}
              {entry.from_status === null && entry.changed_by_employee_id === null
                ? t('adminReports.detail.historySubmitted')
                : t('adminReports.detail.historyBy', {
                    name: labels.author(entry.changed_by_employee_id),
                  })}
            </p>
            {entry.note ? (
              <div
                className={cn(
                  'mt-2.5 rounded-lg border px-3.5 py-3 text-sm',
                  entry.note_is_public
                    ? 'border-info-border bg-info-soft'
                    : 'border-border bg-surface-subtle',
                )}
              >
                <Badge
                  tone={entry.note_is_public ? 'info' : 'neutral'}
                  size="sm"
                  className="mb-1.5"
                >
                  {entry.note_is_public
                    ? t('adminReports.detail.notePublic')
                    : t('adminReports.detail.noteInternal')}
                </Badge>
                <p className="whitespace-pre-line text-foreground" dir="auto">
                  {entry.note}
                </p>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Comments, oldest first, each clearly marked internal or public. */
export function ReportComments({
  comments,
  labels,
  locale,
  t,
}: {
  comments: readonly StaffReportComment[];
  labels: ReportLabels;
  locale: Locale;
  t: Translator;
}) {
  if (comments.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-5 text-sm text-muted">
        <Icon name="message" className="size-4 text-subtle" />
        {t('adminReports.comments.empty')}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {comments.map((comment) => {
        const author = comment.from_reporter
          ? t('adminReports.people.reporter')
          : labels.author(comment.author_employee_id);
        return (
          <li key={comment.id} className="flex gap-3">
            {comment.from_reporter ? (
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-soft text-info ring-1 ring-info-border ring-inset"
              >
                <Icon name="user" className="size-4" />
              </span>
            ) : (
              <Avatar name={author} size="md" />
            )}
            <div
              className={cn(
                'min-w-0 flex-1 rounded-xl rounded-ss-sm border px-4 py-3 shadow-xs',
                comment.is_internal
                  ? 'border-warning-border bg-warning-soft/60'
                  : 'border-border bg-surface',
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-foreground">{author}</span>
                {comment.is_internal ? (
                  <Badge tone="warning" size="sm" dot>
                    {t('adminReports.comments.internal')}
                  </Badge>
                ) : (
                  <Badge tone="info" size="sm" dot>
                    {comment.from_reporter
                      ? t('adminReports.comments.fromReporter')
                      : t('adminReports.comments.public')}
                  </Badge>
                )}
                <span className="ms-auto text-xs text-muted tabular-nums">
                  {formatDateTime(locale, comment.created_at)}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground" dir="auto">
                {comment.body}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
