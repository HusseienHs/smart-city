'use client';

import type { Locale } from '@smart-city/shared';
import { useActionState } from 'react';

import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { translatorFor } from '@/lib/reports/strings';
import { staffSignUpAction, type StaffActionState } from '@/lib/staff/actions';
import type { StaffStrings } from '@/lib/staff/strings';

const initial: StaffActionState = { status: 'idle' };

/**
 * Account registration for invited staff. The account grants nothing until the person confirms
 * their email and accepts an invitation addressed to it on the access page.
 */
export function StaffSignUpForm({
  locale,
  strings,
  signInHref,
}: {
  locale: Locale;
  strings: StaffStrings;
  signInHref: string;
}) {
  const t = translatorFor(strings);
  const [state, action] = useActionState(staffSignUpAction, initial);

  if (state.status === 'success') {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          <p className="font-medium text-foreground">{t('adminJoin.sentTitle')}</p>
          <p className="mt-0.5">{state.message}</p>
        </Alert>
        <ButtonLink href={signInHref} variant="secondary" className="w-full">
          {t('adminJoin.signIn')}
        </ButtonLink>
      </div>
    );
  }

  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};
  const typed = state.status === 'error' ? state.values : undefined;
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {state.status === 'error' && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}
      <Field label={t('adminJoin.fullName')} error={errors.fullName}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="fullName"
            autoComplete="name"
            required
            maxLength={100}
            defaultValue={typed?.fullName}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <Field label={t('adminJoin.email')} error={errors.email}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            required
            defaultValue={typed?.email}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <Field
        label={t('adminJoin.password')}
        hint={t('auth.errors.passwordTooShort')}
        error={errors.password}
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <Field label={t('adminJoin.confirmPassword')} error={errors.confirm}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <p className="text-xs text-muted">{t('adminJoin.confirmedNote')}</p>
      <SubmitButton variant="primary" pendingLabel={t('adminJoin.pending')} className="w-full">
        {t('adminJoin.submit')}
      </SubmitButton>
    </form>
  );
}
