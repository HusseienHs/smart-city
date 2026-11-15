'use client';

import { useActionState, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { StaffActionState } from '@/lib/staff/actions';

import { CopyLink } from './copy-link';

const initial: StaffActionState = { status: 'idle' };

interface ConfirmActionFormProps {
  action: (previous: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  /** Hidden fields sent with the action (ids, locale, flags). */
  fields: Readonly<Record<string, string>>;
  label: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  /** Labels for the copyable link some results carry (re-invite). */
  linkLabels?: { copy: string; copied: string; failed: string };
}

/**
 * A single sensitive action: a button that asks for confirmation, then submits a Server Action
 * and shows its localized result. The Server Action re-authorizes; the database decides.
 */
export function ConfirmActionForm({
  action,
  fields,
  label,
  pendingLabel,
  variant = 'secondary',
  size = 'md',
  disabled,
  confirmTitle,
  confirmBody,
  confirmLabel,
  cancelLabel,
  danger,
  linkLabels,
}: ConfirmActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HTMLFormElement | null>(null);

  return (
    <form ref={setForm} action={formAction} className="flex flex-col gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.status !== 'idle' && state.message ? (
        <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.link && linkLabels ? (
        <CopyLink value={state.link} labels={linkLabels} />
      ) : null}
      <div>
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={disabled || pending}
          aria-busy={pending || undefined}
          onClick={() => setOpen(true)}
        >
          {pending ? pendingLabel : label}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        title={confirmTitle}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        tone={danger ? 'danger' : 'primary'}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          form?.requestSubmit();
        }}
      >
        {confirmBody}
      </ConfirmDialog>
    </form>
  );
}
