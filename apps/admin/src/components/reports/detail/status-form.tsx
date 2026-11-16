'use client';

import { REPORT_REJECTION_REASONS, type Locale, type ReportStatus } from '@smart-city/shared';
import { useActionState, useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, Spinner } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { controlClasses, Field, Select, TextInput } from '@/components/ui/field';
import { changeReportStatusAction, type ReportActionState } from '@/lib/reports/actions';
import { needsConfirmation } from '@/lib/reports/capabilities';
import { translatorFor, type ReportStrings } from '@/lib/reports/strings';

const initial: ReportActionState = { status: 'idle' };

interface StatusFormProps {
  locale: Locale;
  reportId: string;
  strings: ReportStrings;
  /** The statuses this role may move the report to (already filtered). */
  targets: readonly ReportStatus[];
  /** Resolving needs a completion photo and the report has none yet. */
  completionPhotoMissing: boolean;
}

/**
 * Changes the status through update_report_status. Resolving and rejecting always carry a
 * public message to the resident; important changes are confirmed first. The server action
 * and the database validate everything again.
 */
export function StatusForm({
  locale,
  reportId,
  strings,
  targets,
  completionPhotoMissing,
}: StatusFormProps) {
  const t = translatorFor(strings);
  const [state, action, pending] = useActionState(changeReportStatusAction, initial);
  const [target, setTarget] = useState<ReportStatus | ''>('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  // After a successful change the report has a new status: start over (the fields remount,
  // the success message stays).
  const [handledKey, setHandledKey] = useState<number | undefined>(undefined);
  if (state.status === 'success' && state.key !== handledKey) {
    setHandledKey(state.key);
    setTarget('');
    setReason('');
    setClientErrors({});
  }

  const publicNote = target === 'resolved' || target === 'rejected';
  const errors = { ...(state.status === 'error' ? state.fieldErrors : undefined), ...clientErrors };

  const validate = (data: FormData): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!target) found.status = t('adminReports.status.choose');
    const note = String(data.get('note') ?? '').trim();
    if (publicNote && note.length < 5) found.note = t('adminReports.status.publicNoteRequired');
    if (target === 'rejected') {
      if (!reason) found.rejectionReason = t('adminReports.status.reasonRequired');
      else if (reason === 'duplicate' && !String(data.get('duplicateOf') ?? '').trim()) {
        found.duplicateOf = t('adminReports.status.duplicateRequired');
      }
    }
    return found;
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const found = validate(new FormData(event.currentTarget));
    setClientErrors(found);
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      return;
    }
    if (target && needsConfirmation(target) && !confirmed.current) {
      event.preventDefault();
      setConfirming(true);
      return;
    }
    confirmed.current = false;
  };

  if (targets.length === 0) return null;

  const statusLabel = target ? t(`reportStatus.${target}`) : '';
  return (
    <form ref={form} action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reportId" value={reportId} />

      {state.status === 'success' && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}
      {state.status === 'error' && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div key={handledKey ?? 0} className="flex flex-col gap-4">
        <Field label={t('adminReports.status.moveTo')} error={errors.status}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="status"
              value={target}
              onChange={(event) => setTarget(event.target.value as ReportStatus | '')}
              aria-describedby={describedBy}
              invalid={invalid}
            >
              <option value="">{t('adminReports.status.choose')}</option>
              {targets.map((status) => (
                <option key={status} value={status}>
                  {t(`reportStatus.${status}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {target === 'resolved' && completionPhotoMissing ? (
          <Alert tone="warning">{t('adminReports.status.completionRequired')}</Alert>
        ) : null}

        {target === 'rejected' ? (
          <Field label={t('adminReports.status.reason')} error={errors.rejectionReason}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="rejectionReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
              >
                <option value="">{t('adminReports.status.chooseReason')}</option>
                {REPORT_REJECTION_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`reportRejectionReason.${value}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {target === 'rejected' && reason === 'duplicate' ? (
          <Field
            label={t('adminReports.status.duplicateOf')}
            hint={t('adminReports.status.duplicateHint')}
            error={errors.duplicateOf}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="duplicateOf"
                defaultValue={state.status === 'error' ? state.values?.duplicateOf : undefined}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                maxLength={20}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
        ) : null}

        {target ? (
          <Field
            label={publicNote ? t('adminReports.status.publicNote') : t('adminReports.status.note')}
            hint={
              publicNote
                ? t('adminReports.status.publicNoteHint')
                : t('adminReports.status.noteHint')
            }
            error={errors.note}
          >
            {({ id, describedBy, invalid }) => (
              <textarea
                id={id}
                name="note"
                defaultValue={state.status === 'error' ? state.values?.note : undefined}
                maxLength={2000}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                aria-required={publicNote || undefined}
                className={controlClasses(invalid, 'h-auto min-h-24 px-3 py-2 leading-relaxed')}
              />
            )}
          </Field>
        ) : null}

        {target && !publicNote ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm text-foreground-secondary transition-colors hover:bg-surface-subtle has-checked:border-primary-soft-border has-checked:bg-primary-soft has-checked:text-foreground">
            <input
              type="checkbox"
              name="notePublic"
              className="size-4 accent-[var(--color-primary)]"
            />
            {t('adminReports.status.makePublic')}
          </label>
        ) : null}
      </div>

      <div>
        <Button
          type="submit"
          variant={target === 'rejected' ? 'danger' : 'primary'}
          disabled={pending || !target}
          aria-busy={pending || undefined}
          className="w-full"
        >
          {pending ? <Spinner /> : null}
          {pending ? t('adminReports.status.saving') : t('adminReports.status.submit')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('adminReports.status.confirmTitle', { status: statusLabel })}
        confirmLabel={t('adminReports.confirm')}
        cancelLabel={t('adminReports.cancel')}
        tone={target === 'rejected' || target === 'closed' ? 'danger' : 'primary'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          confirmed.current = true;
          form.current?.requestSubmit();
        }}
      >
        {target === 'resolved'
          ? t('adminReports.status.confirmResolved')
          : target === 'rejected'
            ? t('adminReports.status.confirmRejected')
            : t('adminReports.status.confirmClosed')}
      </ConfirmDialog>
    </form>
  );
}
