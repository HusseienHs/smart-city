import { DEFAULT_LOCALE, REPORT_STATUSES } from '@smart-city/shared';
import { createTranslator, type MessageKey } from '@smart-city/shared/i18n';

import { PageHeader } from '@/components/page-header';
import { isSupabaseConfigured } from '@/lib/env';

const t = createTranslator(DEFAULT_LOCALE);

const KPIS: readonly MessageKey[] = [
  'adminOverview.totalReports',
  'adminOverview.pendingReports',
  'adminOverview.resolvedReports',
  'adminOverview.avgResolutionTime',
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader title={t('adminNav.overview')} description={t('adminOverview.subtitle')} />

      <p
        role="status"
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-xs text-muted"
      >
        <span
          className={`size-2 rounded-full ${isSupabaseConfigured ? 'bg-primary' : 'bg-muted'}`}
          aria-hidden
        />
        {isSupabaseConfigured ? t('backend.connected') : t('backend.notConfigured')}
      </p>

      {/* KPI values are intentionally empty: no metric is shown until real data exists. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((key) => (
          <div key={key} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">{t(key)}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">—</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-sm text-muted">{t('adminOverview.noData')}</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-medium">{t('adminOverview.statusWorkflow')}</h2>
        <ol className="flex flex-wrap gap-2">
          {REPORT_STATUSES.map((status) => (
            <li
              key={status}
              className="rounded-full border border-border bg-surface-muted px-3 py-1 text-sm"
            >
              {t(`reportStatus.${status}`)}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
