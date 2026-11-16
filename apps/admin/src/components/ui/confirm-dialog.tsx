'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Button } from './button';
import { Icon } from './icon';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` for actions that can't be undone. */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation built on the native <dialog>: focus moves into it and is trapped, Escape
 * cancels, and the page behind is inert while it is open.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const danger = tone === 'danger';

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised p-0 text-foreground shadow-lg open:animate-dialog-in"
    >
      <div className="relative px-6 pt-6 pb-5">
        {/* A soft wash of the dialog's tone behind the icon. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent',
            danger ? 'from-danger-soft' : 'from-primary-soft',
          )}
        />
        <span
          className={cn(
            'relative flex size-12 items-center justify-center rounded-xl ring-1 ring-inset',
            danger
              ? 'bg-danger-soft text-danger ring-danger-border'
              : 'bg-primary-soft text-accent ring-primary-soft-border',
          )}
          aria-hidden
        >
          <Icon name={danger ? 'alert' : 'info'} className="size-[22px]" />
        </span>
        <h2 id={titleId} className="relative mt-4 text-lg leading-7 font-semibold tracking-tight">
          {title}
        </h2>
        {children ? (
          <div id={bodyId} className="relative mt-1.5 text-base leading-6 text-muted">
            {children}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 border-t border-border bg-surface-subtle px-6 py-4 sm:flex sm:justify-end">
        <Button variant="secondary" onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
