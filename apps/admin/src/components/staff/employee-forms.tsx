'use client';

import {
  JOB_TITLE_MAX_LENGTH,
  MUNICIPAL_STAFF_ROLES,
  roleRequiresDepartment,
  type Locale,
  type MunicipalStaffRole,
} from '@smart-city/shared';
import { useActionState, useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Select, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { translatorFor } from '@/lib/reports/strings';
import {
  setEmployeeRoleAction,
  updateJobTitleAction,
  type StaffActionState,
} from '@/lib/staff/actions';
import { leavesDepartment } from '@/lib/staff/capabilities';
import type { StaffStrings } from '@/lib/staff/strings';

const initial: StaffActionState = { status: 'idle' };

function Result({ state }: { state: StaffActionState }) {
  if (state.status === 'idle' || !state.message || state.fieldErrors) return null;
  return <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert>;
}

export function JobTitleForm({
  locale,
  strings,
  employeeId,
  jobTitle,
}: {
  locale: Locale;
  strings: StaffStrings;
  employeeId: string;
  jobTitle: string | null;
}) {
  const t = translatorFor(strings);
  const [state, action] = useActionState(updateJobTitleAction, initial);
  const typed = state.status === 'error' ? state.values : undefined;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <Result state={state} />
      <Field
        label={t('adminEmployees.detail.jobTitle')}
        hint={t('adminEmployees.detail.jobTitleHint')}
        error={state.status === 'error' ? state.fieldErrors?.jobTitle : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="jobTitle"
            maxLength={JOB_TITLE_MAX_LENGTH}
            defaultValue={typed?.jobTitle ?? jobTitle ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <div>
        <SubmitButton variant="secondary" pendingLabel={t('adminStaff.saving')}>
          {t('adminEmployees.detail.saveJobTitle')}
        </SubmitButton>
      </div>
    </form>
  );
}

interface RoleFormProps {
  locale: Locale;
  strings: StaffStrings;
  employee: {
    id: string;
    name: string;
    role: MunicipalStaffRole;
    departmentId: string | null;
  };
  /** Active departments to move to. */
  departments: readonly { id: string; label: string }[];
  /** Active employees/managers of the CURRENT department who could take over open reports. */
  handoverCandidates: readonly { id: string; label: string }[];
  /** Open reports currently assigned to the employee. */
  openReports: number;
}

/**
 * Role and department through set_employee_role. When the change takes the employee out of
 * their department, the admin chooses who takes over their open reports (or the department
 * queue). The change is confirmed first; the result says how many reports were handed over.
 */
export function RoleForm({
  locale,
  strings,
  employee,
  departments,
  handoverCandidates,
  openReports,
}: RoleFormProps) {
  const t = translatorFor(strings);
  const [state, action, pending] = useActionState(setEmployeeRoleAction, initial);
  const [role, setRole] = useState<MunicipalStaffRole>(employee.role);
  const [department, setDepartment] = useState(employee.departmentId ?? '');
  const [confirming, setConfirming] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  const needsDepartment = roleRequiresDepartment(role);
  const next = { role, departmentId: needsDepartment ? department || null : null };
  const leaving = leavesDepartment(employee, next);
  const unchanged = next.role === employee.role && next.departmentId === employee.departmentId;
  const departmentLabel = departments.find((d) => d.id === next.departmentId)?.label ?? '';

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    setConfirming(true);
  };

  return (
    <form ref={form} action={action} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="employeeId" value={employee.id} />
      <Result state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adminEmployees.role.role')}>
          {({ id }) => (
            <Select
              id={id}
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as MunicipalStaffRole)}
            >
              {MUNICIPAL_STAFF_ROLES.map((value) => (
                <option key={value} value={value}>
                  {t(`staffRole.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('adminEmployees.role.department')}
          hint={needsDepartment ? undefined : t('adminEmployees.role.noDepartmentForRole')}
          error={state.status === 'error' ? state.fieldErrors?.departmentId : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="departmentId"
              value={needsDepartment ? department : ''}
              disabled={!needsDepartment}
              onChange={(event) => setDepartment(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            >
              <option value="">{t('adminEmployees.role.chooseDepartment')}</option>
              {departments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {leaving && openReports > 0 ? (
        <fieldset className="flex flex-col gap-2 rounded-md border border-warning-border bg-warning-soft/40 p-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            {t('adminEmployees.role.handover', { count: openReports })}
          </legend>
          <p className="text-sm text-muted">{t('adminEmployees.role.handoverHint')}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="reassignTo"
              value=""
              defaultChecked
              className="size-4 accent-[var(--color-primary)]"
            />
            {t('adminEmployees.role.handoverQueue')}
          </label>
          {handoverCandidates.map((candidate) => (
            <label key={candidate.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reassignTo"
                value={candidate.id}
                className="size-4 accent-[var(--color-primary)]"
              />
              {t('adminEmployees.role.handoverTo', { name: candidate.label })}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || unchanged || (needsDepartment && !department)}
          aria-busy={pending || undefined}
        >
          {pending ? t('adminStaff.saving') : t('adminEmployees.role.submit')}
        </Button>
        {unchanged ? (
          <p className="mt-1.5 text-xs text-muted">{t('adminEmployees.role.unchanged')}</p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('adminEmployees.role.confirmTitle')}
        confirmLabel={t('adminStaff.confirm')}
        cancelLabel={t('adminStaff.cancel')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          confirmed.current = true;
          form.current?.requestSubmit();
        }}
      >
        {next.departmentId
          ? t('adminEmployees.role.confirm', {
              name: employee.name,
              role: t(`staffRole.${role}`),
              department: departmentLabel,
            })
          : t('adminEmployees.role.confirmNoDepartment', {
              name: employee.name,
              role: t(`staffRole.${role}`),
            })}
      </ConfirmDialog>
    </form>
  );
}
