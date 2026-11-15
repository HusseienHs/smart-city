'use client';

import {
  JOB_TITLE_MAX_LENGTH,
  MUNICIPAL_STAFF_ROLES,
  roleRequiresDepartment,
  type Locale,
  type MunicipalStaffRole,
} from '@smart-city/shared';
import { useActionState, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Field, Select, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { translatorFor } from '@/lib/reports/strings';
import { inviteStaffAction, type StaffActionState } from '@/lib/staff/actions';
import type { StaffStrings } from '@/lib/staff/strings';

import { CopyLink } from './copy-link';

const initial: StaffActionState = { status: 'idle' };

/**
 * Creates an invitation. No email is sent: on success the onboarding link is shown to copy and
 * send to the invited person. Department choices are the active departments only.
 */
export function InviteForm({
  locale,
  strings,
  departments,
}: {
  locale: Locale;
  strings: StaffStrings;
  departments: readonly { id: string; label: string }[];
}) {
  const t = translatorFor(strings);
  const [state, action] = useActionState(inviteStaffAction, initial);
  const typed = state.status === 'error' ? state.values : undefined;
  const [role, setRole] = useState<MunicipalStaffRole>('employee');
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};
  const needsDepartment = roleRequiresDepartment(role);
  const linkLabels = {
    copy: t('adminInvitations.copy'),
    copied: t('adminInvitations.copied'),
    failed: t('adminInvitations.copyFailed'),
  };

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {state.status === 'success' ? (
        <div className="flex flex-col gap-3 rounded-md border border-success-border bg-success-soft/40 p-4">
          <Alert tone="success">{state.message}</Alert>
          {state.link ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">
                {t('adminInvitations.linkTitle')}
              </p>
              <p className="text-sm text-muted">{t('adminInvitations.linkDescription')}</p>
              <CopyLink value={state.link} labels={linkLabels} />
            </div>
          ) : null}
        </div>
      ) : null}
      {state.status === 'error' && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t('adminInvitations.email')}
          hint={t('adminInvitations.emailHint')}
          error={errors.email}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="email"
              type="email"
              dir="ltr"
              autoComplete="off"
              required
              maxLength={254}
              defaultValue={typed?.email}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field label={t('adminInvitations.role')} error={errors.role}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as MunicipalStaffRole)}
              aria-describedby={describedBy}
              invalid={invalid}
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
          label={t('adminInvitations.department')}
          hint={needsDepartment ? undefined : t('adminInvitations.noDepartmentForRole')}
          error={errors.departmentId}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="departmentId"
              disabled={!needsDepartment}
              defaultValue={typed?.departmentId ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            >
              <option value="">{t('adminInvitations.chooseDepartment')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('adminInvitations.jobTitle')}
          hint={t('adminEmployees.detail.jobTitleHint')}
          error={errors.jobTitle}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="jobTitle"
              maxLength={JOB_TITLE_MAX_LENGTH}
              defaultValue={typed?.jobTitle}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <div>
        <SubmitButton variant="primary" icon="mail" pendingLabel={t('adminInvitations.creating')}>
          {t('adminInvitations.submit')}
        </SubmitButton>
      </div>
    </form>
  );
}
