'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from './button';

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

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-md font-semibold">
          {title}
        </h2>
        {children ? (
          <div id={bodyId} className="mt-2 text-sm text-foreground-secondary">
            {children}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="secondary" onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
