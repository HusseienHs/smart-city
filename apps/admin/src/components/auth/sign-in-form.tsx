'use client';

import type { Locale } from '@smart-city/shared';
import Link from 'next/link';
import { useActionState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Field, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { signInAction, type AuthFormState } from '@/lib/auth/actions';

export interface SignInLabels {
  email: string;
  password: string;
  forgotPassword: string;
  submit: string;
  pending: string;
}

interface SignInFormProps {
  locale: Locale;
  /** Where to return after signing in; re-validated on the server. */
  next?: string;
  forgotPasswordHref: string;
  labels: SignInLabels;
}

const initialState: AuthFormState = { status: 'idle' };

export function SignInForm({ locale, next, forgotPasswordHref, labels }: SignInFormProps) {
  const [state, action] = useActionState(signInAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

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

      <Field label={labels.password} error={errors.password}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <div className="-mt-2 flex justify-end">
        <Link href={forgotPasswordHref} className="text-sm font-medium text-accent hover:underline">
          {labels.forgotPassword}
        </Link>
      </div>

      <SubmitButton variant="primary" size="lg" pendingLabel={labels.pending} className="w-full">
        {labels.submit}
      </SubmitButton>
    </form>
  );
}
