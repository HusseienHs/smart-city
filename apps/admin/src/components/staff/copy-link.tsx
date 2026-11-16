'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';

/** A read-only link with a copy button (the onboarding link admins send to invitees). */
export function CopyLink({
  value,
  labels,
}: {
  value: string;
  labels: { copy: string; copied: string; failed: string };
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={value}
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          className={controlClasses(
            false,
            'min-w-0 flex-1 bg-surface-subtle px-3 font-mono text-sm',
          )}
          aria-label={labels.copy}
        />
        <Button
          variant="secondary"
          icon={status === 'copied' ? 'check' : 'copy'}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setStatus('copied');
            } catch {
              setStatus('failed');
            }
          }}
        >
          {status === 'copied' ? labels.copied : labels.copy}
        </Button>
      </div>
      <p role="status" className="text-xs text-muted">
        {status === 'failed' ? labels.failed : ''}
      </p>
    </div>
  );
}
