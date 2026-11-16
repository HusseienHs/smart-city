'use client';

import type { Locale } from '@smart-city/shared';
import { useActionState } from 'react';

import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { requestPasswordResetAction, type AuthFormState } from '@/lib/auth/actions';

export interface ForgotPasswordLabels {
  email: string;
  submit: string;
  pending: string;
  sentTitle: string;
  /** Contains `{email}`. */
  sentDescription: string;
  backToSignIn: string;
}

const initialState: AuthFormState = { status: 'idle' };

export function ForgotPasswordForm({
  locale,
  signInHref,
  labels,
}: {
  locale: Locale;
  signInHref: string;
  labels: ForgotPasswordLabels;
}) {
  const [state, action] = useActionState(requestPasswordResetAction, initialState);

  if (state.status === 'sent') {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">
          <p className="font-medium text-foreground">{labels.sentTitle}</p>
          <p className="mt-0.5">{labels.sentDescription.replace('{email}', state.email ?? '')}</p>
        </Alert>
        <ButtonLink href={signInHref} variant="secondary" className="w-full">
          {labels.backToSignIn}
        </ButtonLink>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label={labels.email} error={errors.email}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            required
            autoFocus
            defaultValue={state.email}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <SubmitButton variant="primary" size="lg" pendingLabel={labels.pending} className="w-full">
        {labels.submit}
      </SubmitButton>
      <ButtonLink href={signInHref} variant="ghost" className="w-full">
        {labels.backToSignIn}
      </ButtonLink>
    </form>
  );
}
