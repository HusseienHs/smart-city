interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
      <span
        className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="size-7"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
    </div>
  );
}
