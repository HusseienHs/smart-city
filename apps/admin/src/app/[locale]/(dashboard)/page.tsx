import { DEFAULT_LOCALE, REPORT_STATUSES } from '@smart-city/shared';
import { createTranslator, type MessageKey } from '@smart-city/shared/i18n';

import { PageHeader } from '@/components/page-header';
import { isSupabaseConfigured } from '@/lib/env';

const t = createTranslator(DEFAULT_LOCALE);

/** Each KPI with its icon (SVG path, 24×24 stroke) and accent classes. */
const KPIS: readonly { label: MessageKey; icon: string; accent: string }[] = [
  {
    label: 'adminOverview.totalReports',
    icon: 'M9 5h6M9 3h6v4H9zM5 5h2v16h10V5h2v16H5z',
    accent: 'bg-primary-soft text-primary',
  },
  {
    label: 'adminOverview.pendingReports',
    icon: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    accent: 'bg-warning-soft text-warning',
  },
  {
    label: 'adminOverview.resolvedReports',
    icon: 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    accent: 'bg-success-soft text-success',
  },
  {
    label: 'adminOverview.avgResolutionTime',
    icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    accent: 'bg-info-soft text-info',
  },
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader title={t('adminNav.overview')} description={t('adminOverview.subtitle')} />

      <p
        role="status"
        className={`mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
          isSupabaseConfigured ? 'bg-success-soft text-success' : 'bg-surface-muted text-muted'
        }`}
      >
        <span
          className={`size-2 rounded-full ${isSupabaseConfigured ? 'bg-success' : 'bg-muted'}`}
          aria-hidden
        />
        {isSupabaseConfigured ? t('backend.connected') : t('backend.notConfigured')}
      </p>

      {/* KPI values are intentionally empty: no metric is shown until real data exists. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-muted">{t(kpi.label)}</p>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${kpi.accent}`}
                aria-hidden
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={kpi.icon} />
                </svg>
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">—</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-sm text-muted">{t('adminOverview.noData')}</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-5 text-lg font-semibold">{t('adminOverview.statusWorkflow')}</h2>
        <ol className="flex flex-wrap items-center gap-y-3">
          {REPORT_STATUSES.map((status, index) => (
            <li key={status} className="flex items-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted py-1 ps-1 pe-3 text-sm font-medium">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white tabular-nums">
                  {index + 1}
                </span>
                {t(`reportStatus.${status}`)}
              </span>
              {index < REPORT_STATUSES.length - 1 ? (
                <span className="mx-1.5 h-px w-5 bg-border-strong" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
