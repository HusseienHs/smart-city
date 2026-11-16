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
      className="m-auto w-[min(28rem,calc(100vw-2rem))] popover p-0 text-foreground open:animate-dialog-in"
    >
      <div className="flex gap-4 p-5 sm:p-6">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full border',
            danger
              ? 'border-danger-border bg-danger-soft text-danger'
              : 'border-primary-soft-border bg-primary-soft text-accent',
          )}
          aria-hidden
        >
          <Icon name={danger ? 'alert' : 'info'} className="size-[18px]" />
        </span>
        <div className="min-w-0 pt-1.5">
          <h2 id={titleId} className="text-md leading-6 font-semibold">
            {title}
          </h2>
          {children ? (
            <div id={bodyId} className="mt-1.5 text-base text-muted">
              {children}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-subtle px-5 py-3 sm:px-6">
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
