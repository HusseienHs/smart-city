'use client';

import { REPORT_COMMENT_MAX_LENGTH } from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import { useActionState, useId, useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, Spinner } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { controlClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { addReportCommentAction, type ReportActionState } from '@/lib/reports/actions';
import { translatorFor, type ReportStrings } from '@/lib/reports/strings';

const initial: ReportActionState = { status: 'idle' };

/**
 * Adds a staff comment. Internal is the default; choosing "public" shows a warning, changes the
 * button, and asks for confirmation, because the resident sees it and is notified.
 */
export function CommentForm({
  locale,
  reportId,
  strings,
}: {
  locale: Locale;
  reportId: string;
  strings: ReportStrings;
}) {
  const t = translatorFor(strings);
  const [state, action, pending] = useActionState(addReportCommentAction, initial);
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal');
  const [length, setLength] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const bodyId = useId();
  const counterId = useId();
  const errorId = useId();

  // After posting, start a fresh comment (back to internal); the success message stays.
  const [handledKey, setHandledKey] = useState<number | undefined>(undefined);
  if (state.status === 'success' && state.key !== handledKey) {
    setHandledKey(state.key);
    setVisibility('internal');
    setLength(0);
  }

  const isPublic = visibility === 'public';
  const error = clientError ?? (state.status === 'error' ? state.fieldErrors?.body : undefined);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim();
    if (!body) {
      event.preventDefault();
      setClientError(t('adminReports.comments.required'));
      return;
    }
    if (body.length > REPORT_COMMENT_MAX_LENGTH) {
      event.preventDefault();
      setClientError(t('adminReports.comments.tooLong', { max: REPORT_COMMENT_MAX_LENGTH }));
      return;
    }
    setClientError(null);
    if (isPublic && !confirmed.current) {
      event.preventDefault();
      setConfirming(true);
      return;
    }
    confirmed.current = false;
  };

  return (
    <form ref={form} action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reportId" value={reportId} />

      {state.status === 'success' && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}
      {state.status === 'error' && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <label htmlFor={bodyId} className="text-sm font-medium text-foreground">
        {t('adminReports.comments.body')}
      </label>
      <textarea
        key={handledKey ?? 0}
        id={bodyId}
        defaultValue={state.status === 'error' ? state.values?.body : undefined}
        name="body"
        maxLength={REPORT_COMMENT_MAX_LENGTH}
        onChange={(event) => setLength(event.target.value.length)}
        aria-describedby={[counterId, error ? errorId : null].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        className={controlClasses(Boolean(error), 'h-auto min-h-24 px-3 py-2 leading-relaxed')}
      />
      <div className="-mt-1 flex items-center justify-between gap-2 text-xs">
        {error ? (
          <span id={errorId} role="alert" className="text-danger">
            {error}
          </span>
        ) : (
          <span />
        )}
        <span
          id={counterId}
          className={cn(
            'text-muted tabular-nums',
            length > REPORT_COMMENT_MAX_LENGTH - 100 && 'text-warning',
          )}
        >
          {t('adminReports.comments.counter', { count: length, max: REPORT_COMMENT_MAX_LENGTH })}
        </span>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">
          {t('adminReports.comments.visibility')}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['internal', 'public'] as const).map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors',
                'has-focus-visible:ring-3 has-focus-visible:ring-focus-ring',
                visibility === value
                  ? value === 'public'
                    ? 'border-info-border bg-info-soft text-foreground'
                    : 'border-warning-border bg-warning-soft/60 text-foreground'
                  : 'border-border text-foreground-secondary hover:bg-surface-subtle',
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={visibility === value}
                onChange={() => setVisibility(value)}
                className="size-4 accent-[var(--color-primary)]"
              />
              <Icon
                name={value === 'internal' ? 'lock' : 'eye'}
                className={cn('size-4', value === 'internal' ? 'text-warning' : 'text-info')}
              />
              {value === 'internal'
                ? t('adminReports.comments.internalOption')
                : t('adminReports.comments.publicOption')}
            </label>
          ))}
        </div>
      </fieldset>

      {isPublic ? <Alert tone="warning">{t('adminReports.comments.publicWarning')}</Alert> : null}

      <div>
        <Button
          type="submit"
          variant={isPublic ? 'primary' : 'secondary'}
          disabled={pending}
          aria-busy={pending || undefined}
          icon={pending ? undefined : 'send'}
        >
          {pending ? <Spinner /> : null}
          {pending
            ? t('adminReports.comments.posting')
            : isPublic
              ? t('adminReports.comments.submitPublic')
              : t('adminReports.comments.submit')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('adminReports.comments.confirmPublicTitle')}
        confirmLabel={t('adminReports.comments.submitPublic')}
        cancelLabel={t('adminReports.cancel')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          confirmed.current = true;
          form.current?.requestSubmit();
        }}
      >
        {t('adminReports.comments.publicWarning')}
      </ConfirmDialog>
    </form>
  );
}
