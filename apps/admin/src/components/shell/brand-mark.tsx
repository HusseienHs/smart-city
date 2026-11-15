/** The Smart City product mark: a stylized city skyline on the primary blue. */
export function BrandMark() {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-sm"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[18px]"
      >
        <path d="M5 19V11l4-2.5V19" />
        <path d="M9 19V6l6 3v10" />
        <path d="M15 19v-6l4 2v4" />
        <path d="M3.5 19h17" />
      </svg>
    </span>
  );
}
