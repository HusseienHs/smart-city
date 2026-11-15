import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square button holding only an icon; it must have an accessible label. */
  iconOnly?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-xs hover:bg-primary-hover active:bg-primary-pressed',
  secondary:
    'border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-subtle active:bg-surface-muted',
  ghost: 'text-foreground-secondary hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-danger text-white shadow-xs hover:bg-danger-hover',
};

const SIZES: Record<ButtonSize, { text: string; square: string }> = {
  sm: { text: 'h-8 gap-1.5 px-3 text-sm', square: 'size-8' },
  md: { text: 'h-9 gap-2 px-3.5 text-sm', square: 'size-9' },
};

/** Button styling, also for links that look like buttons. */
export function buttonClasses({ variant = 'secondary', size = 'md', iconOnly }: ButtonStyle = {}) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-sm font-medium',
    'transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    iconOnly ? SIZES[size].square : SIZES[size].text,
  );
}

interface ContentProps {
  icon?: IconName;
  children?: ReactNode;
}

function Content({ icon, children }: ContentProps) {
  return (
    <>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {children}
    </>
  );
}

type ButtonProps = ButtonStyle & ContentProps & ComponentProps<'button'>;

export function Button({
  variant,
  size,
  iconOnly,
  icon,
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
      <Content icon={icon}>{children}</Content>
    </button>
  );
}

type ButtonLinkProps = ButtonStyle & ContentProps & ComponentProps<typeof Link>;

export function ButtonLink({
  variant,
  size,
  iconOnly,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, iconOnly }), className)} {...props}>
      <Content icon={icon}>{children}</Content>
    </Link>
  );
}
