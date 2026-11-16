import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square button holding only an icon; it must have an accessible label. */
  iconOnly?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary shadow-xs hover:bg-primary-hover active:bg-primary-pressed ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.12),var(--elevation-xs)]',
  secondary:
    'border border-border-strong bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-surface-muted active:bg-surface-muted',
  ghost:
    'text-foreground-secondary hover:bg-surface-muted hover:text-foreground active:bg-border/60',
  danger:
    'bg-danger-solid text-white shadow-xs hover:brightness-110 active:brightness-95 ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.12),var(--elevation-xs)]',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
};

const SIZES: Record<ButtonSize, { text: string; square: string; icon: string }> = {
  sm: { text: 'h-8 gap-1.5 px-2.5 text-sm', square: 'size-8', icon: 'size-4' },
  md: { text: 'h-9 gap-2 px-3.5 text-sm', square: 'size-9', icon: 'size-4' },
  lg: { text: 'h-10 gap-2 px-4 text-base', square: 'size-10', icon: 'size-[18px]' },
};

/** Button styling, also for links that look like buttons. */
export function buttonClasses({ variant = 'secondary', size = 'md', iconOnly }: ButtonStyle = {}) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-sm font-medium',
    'transition-[background-color,border-color,color,box-shadow,filter,transform] duration-150 ease-standard',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus-ring',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANTS[variant],
    iconOnly ? SIZES[size].square : SIZES[size].text,
  );
}

interface ContentProps {
  icon?: IconName;
  /** An icon after the label, e.g. a chevron. */
  trailingIcon?: IconName;
  children?: ReactNode;
}

function Content({
  icon,
  trailingIcon,
  size = 'md',
  children,
}: ContentProps & { size?: ButtonSize }) {
  return (
    <>
      {icon ? <Icon name={icon} className={SIZES[size].icon} /> : null}
      {children}
      {trailingIcon ? (
        <Icon name={trailingIcon} className={cn(SIZES[size].icon, 'opacity-70')} />
      ) : null}
    </>
  );
}

type ButtonProps = ButtonStyle & ContentProps & ComponentProps<'button'>;

export function Button({
  variant,
  size,
  iconOnly,
  icon,
  trailingIcon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size, iconOnly }), className)}
      {...props}
    >
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = ButtonStyle & ContentProps & ComponentProps<typeof Link>;

export function ButtonLink({
  variant,
  size,
  iconOnly,
  icon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, iconOnly }), className)} {...props}>
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </Link>
  );
}

/** A small inline spinner for pending buttons. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('size-4 shrink-0 animate-spin', className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
