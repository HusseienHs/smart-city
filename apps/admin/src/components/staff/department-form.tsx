'use client';

import { DEPARTMENT_NAME_MAX_LENGTH, type Locale, type LocalizedText } from '@smart-city/shared';
import { useActionState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Field, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { translatorFor } from '@/lib/reports/strings';
import { saveDepartmentAction, type StaffActionState } from '@/lib/staff/actions';
import type { StaffStrings } from '@/lib/staff/strings';

const initial: StaffActionState = { status: 'idle' };

/**
 * Creates a department (no `department`) or edits one: names in Hebrew (required), Arabic and
 * English, and the public email and phone. Validated again by the Server Action and the
 * database check constraints.
 */
export function DepartmentForm({
  locale,
  strings,
  department,
}: {
  locale: Locale;
  strings: StaffStrings;
  department?: { id: string; name: LocalizedText; email: string | null; phone: string | null };
}) {
  const t = translatorFor(strings);
  const [state, action] = useActionState(saveDepartmentAction, initial);
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};
  // After a refused submission, keep what was typed (React resets uncontrolled fields).
  const typed = state.status === 'error' ? state.values : undefined;
  const optional = t('adminDepartments.form.optional');

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {department ? <input type="hidden" name="departmentId" value={department.id} /> : null}
      {state.status === 'success' && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}
      {state.status === 'error' && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={t('adminDepartments.form.nameHe')}
          hint={t('adminDepartments.form.nameHeHint')}
          error={errors.nameHe}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="nameHe"
              dir="rtl"
              lang="he"
              required
              maxLength={DEPARTMENT_NAME_MAX_LENGTH}
              defaultValue={typed?.nameHe ?? department?.name.he}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field label={t('adminDepartments.form.nameAr')} hint={optional} error={errors.nameAr}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="nameAr"
              dir="rtl"
              lang="ar"
              maxLength={DEPARTMENT_NAME_MAX_LENGTH}
              defaultValue={typed?.nameAr ?? department?.name.ar}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field label={t('adminDepartments.form.nameEn')} hint={optional} error={errors.nameEn}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="nameEn"
              dir="ltr"
              lang="en"
              maxLength={DEPARTMENT_NAME_MAX_LENGTH}
              defaultValue={typed?.nameEn ?? department?.name.en}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('adminDepartments.form.email')} hint={optional} error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="email"
              type="email"
              dir="ltr"
              autoComplete="off"
              maxLength={254}
              defaultValue={typed?.email ?? department?.email ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field
          label={t('adminDepartments.form.phone')}
          hint={t('adminDepartments.form.phoneHint')}
          error={errors.phone}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="phone"
              type="tel"
              dir="ltr"
              autoComplete="off"
              maxLength={20}
              defaultValue={typed?.phone ?? department?.phone ?? ''}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <div>
        <SubmitButton
          variant="primary"
          pendingLabel={department ? t('adminStaff.saving') : t('adminDepartments.form.creating')}
        >
          {department ? t('adminStaff.save') : t('adminDepartments.form.create')}
        </SubmitButton>
      </div>
    </form>
  );
}
