import { cn } from '@/lib/cn';

/** Up to two initials of a display name (first and last word). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase() || '?';
}

/*
 * A deterministic, quiet tint per person, so the same colleague always looks the same in
 * lists. Tints come from the semantic soft palette, which is tuned for both themes.
 */
const TINTS = [
  'bg-primary-soft text-accent border-primary-soft-border',
  'bg-violet-soft text-violet border-violet-border',
  'bg-info-soft text-info border-info-border',
  'bg-success-soft text-success border-success-border',
  'bg-warning-soft text-warning border-warning-border',
] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length]!;
}

const SIZES = {
  xs: 'size-6 text-2xs',
  sm: 'size-7 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-11 text-base',
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Initials in a tinted circle. Decorative: the name is always shown next to it. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold select-none',
        SIZES[size],
        tintFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
