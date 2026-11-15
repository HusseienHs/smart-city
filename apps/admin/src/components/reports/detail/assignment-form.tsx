'use client';

import { REPORT_PRIORITIES, type Locale, type ReportPriority } from '@smart-city/shared';
import { useActionState, useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Select } from '@/components/ui/field';
import { assignReportAction, type ReportActionState } from '@/lib/reports/actions';
import { INTAKE_VALUE, type AssignmentMode } from '@/lib/reports/capabilities';
import { translatorFor, type ReportStrings } from '@/lib/reports/strings';

const initial: ReportActionState = { status: 'idle' };

export interface AssignmentOption {
  id: string;
  label: string;
}

export interface AssigneeOption extends AssignmentOption {
  departmentId: string;
}

interface AssignmentFormProps {
  locale: Locale;
  reportId: string;
  strings: ReportStrings;
  mode: Exclude<AssignmentMode, 'none'>;
  current: { departmentId: string | null; assigneeId: string | null; priority: ReportPriority };
  /** Departments this role may choose (already limited for managers). */
  departments: readonly AssignmentOption[];
  /** Eligible assignees (active employees and managers) of those departments. */
  assignees: readonly AssigneeOption[];
  /** Whether "back to the intake queue" is allowed right now. */
  intakeAllowed: boolean;
}

/**
 * Routing, assignment and priority through assign_report. The form always submits the full
 * state (department, assignee, priority), so changing only the priority keeps the assignment.
 * Returning to intake and moving to another department are confirmed first.
 */
export function AssignmentForm({
  locale,
  reportId,
  strings,
  mode,
  current,
  departments,
  assignees,
  intakeAllowed,
}: AssignmentFormProps) {
  const t = translatorFor(strings);
  const [state, action, pending] = useActionState(assignReportAction, initial);
  const [department, setDepartment] = useState(current.departmentId ?? INTAKE_VALUE);
  // A current assignee who is no longer eligible (left, deactivated) can't be re-sent.
  const [assignee, setAssignee] = useState(
    assignees.some((option) => option.id === current.assigneeId) ? (current.assigneeId ?? '') : '',
  );
  const [confirming, setConfirming] = useState<null | 'intake' | 'transfer'>(null);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  const choosable = assignees.filter((option) => option.departmentId === department);
  const showAssignee = mode !== 'route';
  const departmentLabel = departments.find((d) => d.id === department)?.label ?? '';

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    const toIntake = department === INTAKE_VALUE && current.departmentId !== null;
    const transfer =
      department !== INTAKE_VALUE &&
      current.departmentId !== null &&
      department !== current.departmentId;
    if (toIntake || transfer) {
      event.preventDefault();
      setConfirming(toIntake ? 'intake' : 'transfer');
    }
  };

  return (
    <form ref={form} action={action} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reportId" value={reportId} />

      {state.status === 'success' && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}
      {state.status === 'error' && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <p className="text-sm text-muted">
        {mode === 'route'
          ? t('adminReports.assignment.dispatcherHint')
          : mode === 'department'
            ? t('adminReports.assignment.managerHint')
            : null}
      </p>

      <Field label={t('adminReports.assignment.department')}>
        {({ id }) => (
          <Select
            id={id}
            name="departmentId"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              // An assignee belongs to one department: changing it clears the choice.
              setAssignee('');
            }}
          >
            {intakeAllowed || current.departmentId === null ? (
              <option value={INTAKE_VALUE}>{t('adminReports.assignment.intakeOption')}</option>
            ) : null}
            {departments.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {!intakeAllowed && current.departmentId !== null ? (
        <p className="-mt-2 text-sm text-muted">
          {t('adminReports.assignment.noIntakeInProgress')}
        </p>
      ) : null}

      {showAssignee ? (
        <Field
          label={t('adminReports.assignment.assignee')}
          hint={
            department === INTAKE_VALUE
              ? t('adminReports.assignment.chooseDepartmentFirst')
              : choosable.length === 0
                ? t('adminReports.assignment.noColleagues')
                : t('adminReports.assignment.assigneeHint')
          }
        >
          {({ id, describedBy }) => (
            <Select
              id={id}
              name="assigneeId"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              disabled={department === INTAKE_VALUE}
              aria-describedby={describedBy}
            >
              <option value="">{t('adminReports.assignment.noAssignee')}</option>
              {choosable.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      <Field label={t('adminReports.assignment.priority')}>
        {({ id }) => (
          <Select id={id} name="priority" defaultValue={current.priority}>
            {REPORT_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`reportPriority.${priority}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div>
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending || undefined}>
          {pending ? t('adminReports.assignment.saving') : t('adminReports.assignment.submit')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={
          confirming === 'intake'
            ? t('adminReports.assignment.confirmIntakeTitle')
            : t('adminReports.assignment.confirmTransferTitle')
        }
        confirmLabel={t('adminReports.confirm')}
        cancelLabel={t('adminReports.cancel')}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          confirmed.current = true;
          form.current?.requestSubmit();
        }}
      >
        {confirming === 'intake'
          ? t('adminReports.assignment.confirmIntake')
          : t('adminReports.assignment.confirmTransfer', { department: departmentLabel })}
      </ConfirmDialog>
    </form>
  );
}
