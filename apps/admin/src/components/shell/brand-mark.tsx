import { cn } from '@/lib/cn';

/** The Smart City product mark: a stylized city skyline on the cobalt accent. */
export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-primary text-on-primary',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(16_24_40/0.12)]',
        size === 'lg' ? 'size-10 rounded-lg' : 'size-8 rounded-md',
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={size === 'lg' ? 'size-[22px]' : 'size-[18px]'}
      >
        <path d="M5 19V11l4-2.5V19" />
        <path d="M9 19V6l6 3v10" />
        <path d="M15 19v-6l4 2v4" />
        <path d="M3.5 19h17" />
      </svg>
    </span>
  );
}
