import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon } from './icon';

const CONTROL =
  'h-9 w-full rounded-sm border bg-surface text-base text-foreground shadow-xs ' +
  'transition-[border-color,box-shadow,background-color] duration-150 ease-standard ' +
  'placeholder:text-subtle hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus-ring focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted disabled:shadow-none';

/** Classes for a text control, exported for textareas and custom controls. */
export function controlClasses(invalid: boolean | undefined, className?: string) {
  return cn(
    CONTROL,
    invalid
      ? 'border-danger hover:border-danger focus:border-danger focus:ring-danger/20'
      : 'border-border-strong/80',
    className,
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Receives the ids that connect the control to its label, hint and error. */
  children: (control: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

/** A labelled form control with an optional hint and an inline error. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="flex animate-fade-in items-center gap-1.5 text-sm text-danger"
          role="alert"
        >
          <Icon name="alert" className="size-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextInputProps = ComponentProps<'input'> & { invalid?: boolean };

export function TextInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn('px-3', className))}
      {...props}
    />
  );
}

/** A search box; the icon sits at the start edge in both directions. */
export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <div className={cn('relative', className)}>
      <Icon
        name="search"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
      />
      <input type="search" className={controlClasses(false, 'ps-9 pe-3')} {...props} />
    </div>
  );
}

type SelectProps = ComponentProps<'select'> & { invalid?: boolean };

export function Select({ invalid, className, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-invalid={invalid || undefined}
        className={controlClasses(invalid, 'cursor-pointer appearance-none ps-3 pe-9')}
        {...props}
      >
        {children}
      </select>
      <Icon
        name="chevronsUpDown"
        className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
      />
    </div>
  );
}

type TextAreaProps = ComponentProps<'textarea'> & { invalid?: boolean };

export function TextArea({ invalid, className, ...props }: TextAreaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={controlClasses(
        invalid,
        cn('h-auto min-h-24 px-3 py-2 leading-relaxed', className),
      )}
      {...props}
    />
  );
}
