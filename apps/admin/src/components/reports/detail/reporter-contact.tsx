'use client';

import type { Locale } from '@smart-city/shared';
import { useActionState, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { revealReporterContactAction, type ContactActionState } from '@/lib/reports/actions';
import { translatorFor, type ReportStrings } from '@/lib/reports/strings';

const initial: ContactActionState = { status: 'idle' };

/**
 * The reporter's contact details, loaded only when the staff member asks (each request is
 * audited by the database). Nothing is preloaded, cached or stored; hiding discards the view.
 */
export function ReporterContact({
  locale,
  reportId,
  strings,
}: {
  locale: Locale;
  reportId: string;
  strings: ReportStrings;
}) {
  const t = translatorFor(strings);
  const [state, action, pending] = useActionState(revealReporterContactAction, initial);
  const [hiddenKey, setHiddenKey] = useState<number | undefined>(undefined);
  const shown = state.status === 'success' && state.key !== hiddenKey;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('adminReports.contact.description')}</p>
      <Alert tone="info">{t('adminReports.contact.logged')}</Alert>

      {state.status === 'error' && state.message && state.key !== hiddenKey ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      {shown ? (
        state.contact ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md border border-border bg-surface-subtle p-3 text-sm">
            <dt className="text-muted">{t('adminReports.contact.name')}</dt>
            <dd className="font-medium text-foreground">
              {state.contact.fullName ?? t('adminReports.contact.noName')}
            </dd>
            <dt className="text-muted">{t('adminReports.contact.phone')}</dt>
            <dd className="font-medium text-foreground">
              {state.contact.phone ? (
                <a
                  href={`tel:${state.contact.phone}`}
                  dir="ltr"
                  className="text-primary hover:underline"
                >
                  {state.contact.phone}
                </a>
              ) : (
                t('adminReports.contact.noPhone')
              )}
            </dd>
          </dl>
        ) : (
          <Alert tone="warning">{t('adminReports.contact.unavailable')}</Alert>
        )
      ) : null}

      {shown ? (
        <div>
          <Button variant="secondary" onClick={() => setHiddenKey(state.key)}>
            {t('adminReports.contact.hide')}
          </Button>
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="reportId" value={reportId} />
          <Button
            type="submit"
            variant="secondary"
            icon="account"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? t('adminReports.contact.revealing') : t('adminReports.contact.reveal')}
          </Button>
        </form>
      )}
    </div>
  );
}
