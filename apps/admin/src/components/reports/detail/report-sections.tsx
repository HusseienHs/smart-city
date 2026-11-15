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

import { ReportStatusBadge } from '@/components/report-status-badge';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { formatCoordinate, formatDateTime } from '@/lib/reports/format';
import type { ReportLabels } from '@/lib/reports/labels';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
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
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1.5 text-xs font-medium text-muted">
          {t('adminReports.detail.description')}
        </h3>
        <p className="text-base whitespace-pre-line text-foreground" dir="auto">
          {report.description}
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t('adminReports.columns.category')}>
          {labels.category(report.category_id)}
        </Fact>
        <Fact label={t('adminReports.detail.visibility')}>
          {report.visibility === 'public'
            ? t('adminReports.detail.visibilityPublic')
            : t('adminReports.detail.visibilityPrivate')}
        </Fact>
        <Fact label={t('adminReports.detail.address')}>
          <span dir="auto">{report.address?.trim() || '—'}</span>
        </Fact>
        <Fact label={t('adminReports.detail.neighborhood')}>{neighborhood ?? '—'}</Fact>
        <Fact label={t('adminReports.detail.location')}>
          {location ? (
            <span className="flex flex-col gap-0.5">
              <span dir="ltr" className="font-mono text-sm">
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
                className="text-sm text-primary hover:underline"
              >
                {t('adminReports.detail.openInMap')}
              </a>
            </span>
          ) : (
            t('adminReports.detail.noLocation')
          )}
        </Fact>
        <Fact label={t('adminReports.detail.confirmations')}>
          {report.confirmation_count} · {t('adminReports.detail.followers')} {report.follower_count}
        </Fact>
        <Fact label={t('adminReports.detail.submittedAt')}>
          {formatDateTime(locale, report.created_at)}
        </Fact>
        <Fact label={t('adminReports.detail.updatedAt')}>
          {formatDateTime(locale, report.updated_at)}
        </Fact>
        <Fact label={t('adminReports.detail.statusChangedAt')}>
          {formatDateTime(locale, report.status_changed_at)}
        </Fact>
        {report.rejection_reason ? (
          <Fact label={t('adminReports.detail.rejectionReason')}>
            {t(`reportRejectionReason.${report.rejection_reason}`)}
          </Fact>
        ) : null}
        {duplicateOf ? (
          <Fact label={t('adminReports.detail.duplicateOf')}>
            <Link href={duplicateOf.href} className="text-primary hover:underline" dir="ltr">
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
      <h3 className="mb-2 text-sm font-medium text-foreground-secondary">{title}</h3>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted">{t('adminReports.detail.noPhotos')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((attachment, index) => {
            const signed = media.get(attachment.id);
            const alt = t('adminReports.detail.photoAlt', { index: index + 1, trackingNumber });
            return (
              <li
                key={attachment.id}
                className="overflow-hidden rounded-md border border-border bg-surface-subtle"
              >
                {signed?.viewUrl && signed.displayable ? (
                  <a
                    href={signed.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    {/* Signed, expiring URLs from a private bucket: not suitable for next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signed.viewUrl}
                      alt={alt}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center">
                    <Icon name={signed?.downloadUrl ? 'reports' : 'alert'} className="text-muted" />
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
                    className="block border-t border-border px-2 py-1.5 text-center text-xs font-medium text-primary hover:bg-surface"
                  >
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
    <ol className="relative flex flex-col gap-5 border-s border-border ps-5">
      {history.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            aria-hidden
            className="absolute -start-[25px] top-1 size-2.5 rounded-full border-2 border-surface bg-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            {entry.from_status ? (
              <>
                <ReportStatusBadge
                  status={entry.from_status}
                  label={t(`reportStatus.${entry.from_status}`)}
                />
                <Icon name="chevronEnd" className="size-3.5 text-subtle" />
              </>
            ) : null}
            <ReportStatusBadge
              status={entry.to_status}
              label={t(`reportStatus.${entry.to_status}`)}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {formatDateTime(locale, entry.created_at)}
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
                'mt-2 rounded-md border px-3 py-2 text-sm',
                entry.note_is_public
                  ? 'border-info-border bg-info-soft'
                  : 'border-border bg-surface-subtle',
              )}
            >
              <Badge tone={entry.note_is_public ? 'info' : 'neutral'} className="mb-1">
                {entry.note_is_public
                  ? t('adminReports.detail.notePublic')
                  : t('adminReports.detail.noteInternal')}
              </Badge>
              <p className="whitespace-pre-line text-foreground" dir="auto">
                {entry.note}
              </p>
            </div>
          ) : null}
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
    return <p className="text-sm text-muted">{t('adminReports.comments.empty')}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className={cn(
            'rounded-md border px-3.5 py-3',
            comment.is_internal
              ? 'border-warning-border bg-warning-soft/40'
              : 'border-border bg-surface',
          )}
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {comment.from_reporter
                ? t('adminReports.people.reporter')
                : labels.author(comment.author_employee_id)}
            </span>
            {comment.is_internal ? (
              <Badge tone="warning" dot>
                {t('adminReports.comments.internal')}
              </Badge>
            ) : (
              <Badge tone="info" dot>
                {comment.from_reporter
                  ? t('adminReports.comments.fromReporter')
                  : t('adminReports.comments.public')}
              </Badge>
            )}
            <span className="text-xs text-muted">{formatDateTime(locale, comment.created_at)}</span>
          </div>
          <p className="text-sm whitespace-pre-line text-foreground" dir="auto">
            {comment.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
