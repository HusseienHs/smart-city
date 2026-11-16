import { cn } from '@/lib/cn';

/** Up to two initials of a display name (first and last word). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase() || '?';
}

/*
 * A deterministic gradient per person, so the same colleague always looks the same in lists.
 * The gradients are saturated and dark enough for white initials in both themes and on the
 * ink sidebar.
 */
const GRADIENTS = [
  'from-[#0d9488] to-[#0f5f73]',
  'from-[#6366f1] to-[#3b2fa0]',
  'from-[#0ea5e9] to-[#1d4ed8]',
  'from-[#d97706] to-[#b43c13]',
  'from-[#db2777] to-[#7e22ce]',
  'from-[#16a34a] to-[#0f6b5c]',
  'from-[#475569] to-[#1e293b]',
] as const;

function gradientFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]!;
}

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-7 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-11 text-base',
  xl: 'size-16 text-xl',
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Initials on a gradient disc. Decorative: the name is always shown next to it. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white select-none',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_0_0_1px_rgb(0_0_0/0.06)]',
        SIZES[size],
        gradientFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
