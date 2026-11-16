'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';

import { Button, Spinner } from './button';

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, 'type'> & {
  /** Shown while the form is being submitted. */
  pendingLabel: string;
};

/** A submit button that disables itself and says what is happening while its form is pending. */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  icon,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      icon={pending ? undefined : icon}
      {...props}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
