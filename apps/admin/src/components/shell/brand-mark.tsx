import { cn } from '@/lib/cn';

/**
 * The Smart City product mark: a city skyline over a signal arc, on a teal-to-indigo tile
 * with a soft glow. Reads on the ink sidebar and on light surfaces alike.
 */
export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center bg-gradient-to-br from-[#2dd4bf] via-[#0d9488] to-[#4f46e5] text-white',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_18px_-6px_rgb(45_212_191/0.6)]',
        size === 'lg' ? 'size-11 rounded-xl' : 'size-9 rounded-[10px]',
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={size === 'lg' ? 'size-6' : 'size-5'}
      >
        <path d="M4 20v-7l3.5-2V20" />
        <path d="M7.5 20V8l5-3v15" />
        <path d="M12.5 20v-8l4 2.2V20" />
        <path d="M16.5 20v-3.5L20 15v5" />
        <path d="M3 20h18" />
        <path d="M16 5.2a4 4 0 0 1 3.4 3.3" opacity={0.85} />
      </svg>
    </span>
  );
}
