'use client';

import {
  buildCompletionPhotoPath,
  completionPhotoProblem,
  MAX_COMPLETION_PHOTOS,
  newReportPhotoId,
} from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import { useId, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { publicEnv } from '@/lib/env';
import { registerCompletionPhotoAction } from '@/lib/reports/actions';
import { translatorFor, type ReportStrings } from '@/lib/reports/strings';
import { photoMimeType, UploadFailure, uploadReportMedia } from '@/lib/reports/upload';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type ItemStatus = 'uploading' | 'registering' | 'done' | 'failed';

interface QueueItem {
  key: string;
  name: string;
  file: File;
  mimeType: NonNullable<ReturnType<typeof photoMimeType>>;
  /** Fixed for the life of the item, so a retry targets the same storage object. */
  photoId: string;
  status: ItemStatus;
  progress: number;
  uploaded: boolean;
  error?: string;
}

/**
 * Completion photos, uploaded straight from the browser to the private report-media bucket as
 * the signed-in user, then registered by a Server Action (add_report_attachment re-checks the
 * caller, the report, the limit and the stored file). Each photo keeps one id, so retrying never
 * creates a second file or a second registration.
 */
export function CompletionUpload({
  locale,
  reportId,
  municipalityId,
  strings,
  existing,
}: {
  locale: Locale;
  reportId: string;
  municipalityId: string;
  strings: ReportStrings;
  /** Completion photos already registered on the report. */
  existing: number;
}) {
  const t = translatorFor(strings);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const inFlight = items.filter(
    (item) => item.status !== 'done' && item.status !== 'failed',
  ).length;
  const pendingNew = items.filter((item) => item.status !== 'done').length;
  const remaining = Math.max(0, MAX_COMPLETION_PHOTOS - existing - pendingNew);

  const update = (key: string, change: Partial<QueueItem>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );

  const failureMessage = (reason: UploadFailure['reason']) =>
    reason === 'session'
      ? t('adminReports.completion.sessionExpired')
      : reason === 'refused'
        ? t('adminReports.completion.refused')
        : reason === 'invalid'
          ? t('adminReports.completion.sizeError')
          : t('adminReports.completion.uploadFailed');

  async function process(item: QueueItem) {
    const path = buildCompletionPhotoPath({
      municipalityId,
      reportId,
      photoId: item.photoId,
      mimeType: item.mimeType,
    });
    try {
      if (!item.uploaded) {
        update(item.key, { status: 'uploading', progress: 0, error: undefined });
        const { supabaseUrl, supabasePublishableKey } = publicEnv;
        const { data } = await createSupabaseBrowserClient().auth.getSession();
        const accessToken = data.session?.access_token;
        if (!supabaseUrl || !supabasePublishableKey || !accessToken) {
          throw new UploadFailure('session');
        }
        await uploadReportMedia({
          supabaseUrl,
          publishableKey: supabasePublishableKey,
          accessToken,
          path,
          file: item.file,
          contentType: item.mimeType,
          onProgress: (fraction) => update(item.key, { progress: Math.round(fraction * 100) }),
        });
        item = { ...item, uploaded: true };
        update(item.key, { uploaded: true, progress: 100 });
      }
      update(item.key, { status: 'registering' });
      const result = await registerCompletionPhotoAction({ locale, reportId, storagePath: path });
      if (!result.ok) {
        update(item.key, { status: 'failed', error: result.message });
        return;
      }
      update(item.key, { status: 'done' });
    } catch (error) {
      update(item.key, {
        status: 'failed',
        error:
          error instanceof UploadFailure
            ? failureMessage(error.reason)
            : t('adminReports.completion.uploadFailed'),
      });
    }
  }

  const onFiles = (files: FileList | null) => {
    setNotice(null);
    if (!files || files.length === 0) return;
    const accepted: QueueItem[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const mimeType = photoMimeType(file);
      const problem = mimeType
        ? completionPhotoProblem({ type: mimeType, size: file.size })
        : 'type';
      if (problem || !mimeType) {
        problems.push(
          `${file.name}: ${problem === 'size' ? t('adminReports.completion.sizeError') : t('adminReports.completion.typeError')}`,
        );
        continue;
      }
      accepted.push({
        key: `${file.name}-${file.size}-${newReportPhotoId()}`,
        name: file.name,
        file,
        mimeType,
        photoId: newReportPhotoId(),
        status: 'uploading',
        progress: 0,
        uploaded: false,
      });
    }
    const queued = accepted.slice(0, remaining);
    if (accepted.length > queued.length) {
      problems.push(t('adminReports.completion.tooMany', { count: remaining }));
    }
    if (problems.length > 0) setNotice(problems.join('\n'));
    if (input.current) input.current.value = '';
    if (queued.length === 0) return;
    setItems((current) => [...current, ...queued]);
    // One at a time keeps the per-report storage limit check predictable.
    void queued.reduce<Promise<void>>(
      (chain, item) => chain.then(() => process(item)),
      Promise.resolve(),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {t('adminReports.completion.description', { max: MAX_COMPLETION_PHOTOS })}
      </p>
      {notice ? (
        <Alert tone="warning">
          <span className="whitespace-pre-line">{notice}</span>
        </Alert>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="rounded-md border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm" dir="auto">
                  <Icon name="image" className="size-4 shrink-0 text-subtle" />
                  <span className="truncate">{item.name}</span>
                </span>
                {item.status === 'done' ? (
                  <Badge tone="success" dot>
                    {t('adminReports.completion.done')}
                  </Badge>
                ) : item.status === 'failed' ? (
                  <Badge tone="danger" dot>
                    {t('adminReports.completion.failed')}
                  </Badge>
                ) : item.status === 'registering' ? (
                  <Badge tone="info">{t('adminReports.completion.registering')}</Badge>
                ) : (
                  <Badge tone="info">
                    {t('adminReports.completion.uploading', { percent: item.progress })}
                  </Badge>
                )}
              </div>
              {item.status === 'uploading' ? (
                <div
                  className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  aria-label={item.name}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
              {item.status === 'failed' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="flex-1 text-sm text-danger">{item.error}</p>
                  <Button size="sm" variant="secondary" onClick={() => void process(item)}>
                    {t('adminReports.completion.retry')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setItems((current) => current.filter((other) => other.key !== item.key))
                    }
                  >
                    {t('adminReports.completion.dismiss')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {remaining > 0 ? (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={inputId}
            className={
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong ' +
              'bg-surface-subtle px-4 py-5 text-center text-sm font-medium text-foreground transition-colors ' +
              'hover:border-primary hover:bg-primary-soft/50 has-focus-visible:ring-3 has-focus-visible:ring-focus-ring ' +
              'aria-disabled:opacity-60'
            }
            aria-disabled={inFlight > 0 || undefined}
          >
            <span className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-xs">
              <Icon name="upload" className="size-4" />
            </span>
            {t('adminReports.completion.choose')}
            <input
              ref={input}
              id={inputId}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,.heic,.heif"
              className="sr-only"
              onChange={(event) => onFiles(event.target.files)}
            />
          </label>
          <span className="text-center text-xs text-muted">
            {t('adminReports.completion.remaining', { count: remaining })}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {t('adminReports.completion.limitReached', { max: MAX_COMPLETION_PHOTOS })}
        </p>
      )}
    </div>
  );
}
