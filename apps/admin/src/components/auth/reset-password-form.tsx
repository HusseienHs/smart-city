'use client';

import type { Locale } from '@smart-city/shared';
import { useActionState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Field, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { updatePasswordAction, type AuthFormState } from '@/lib/auth/actions';

export interface ResetPasswordLabels {
  newPassword: string;
  confirmPassword: string;
  hint: string;
  submit: string;
  pending: string;
}

const initialState: AuthFormState = { status: 'idle' };

export function ResetPasswordForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: ResetPasswordLabels;
}) {
  const [state, action] = useActionState(updatePasswordAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label={labels.newPassword} hint={labels.hint} error={errors.password}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            minLength={8}
            maxLength={72}
            required
            autoFocus
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <Field label={labels.confirmPassword} error={errors.confirm}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="confirm"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <SubmitButton variant="primary" size="lg" pendingLabel={labels.pending} className="w-full">
        {labels.submit}
      </SubmitButton>
    </form>
  );
}
