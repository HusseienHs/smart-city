import { REPORT_STATUSES } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import Link from 'next/link';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { ReportStatusBadge } from '@/components/report-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { canAccessModule } from '@/lib/auth/permissions';
import { roleLabel } from '@/lib/auth/role-label';
import { requireStaff } from '@/lib/auth/staff-context';
import { cn } from '@/lib/cn';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { moduleDescriptionKey, NAV_MODULES } from '@/lib/navigation';

const KPIS: readonly { label: MessageKey; icon: IconName }[] = [
  { label: 'adminOverview.totalReports', icon: 'reports' },
  { label: 'adminOverview.pendingReports', icon: 'clock' },
  { label: 'adminOverview.resolvedReports', icon: 'checkCircle' },
  { label: 'adminOverview.avgResolutionTime', icon: 'analytics' },
];

export function generateMetadata() {
  return moduleMetadata('overview');
}

export default function OverviewPage() {
  return (
    <ModuleGuard module="overview">
      <Overview />
    </ModuleGuard>
  );
}

async function Overview() {
  const staff = await requireStaff();
  const locale = await getLocale();
  const t = await getTranslator();
  const seesReports = canAccessModule(staff.role, 'reports');
  const modules = NAV_MODULES.filter(
    (entry) => entry.id !== 'overview' && canAccessModule(staff.role, entry.id),
  );
  const municipality = staff.active ? localizedText(staff.active.municipality_name, locale) : null;
  const role = roleLabel(t, staff.role);

  return (
    <>
      <PageHeader
        title={t('adminNav.overview')}
        description={t('adminOverview.subtitle')}
        meta={
          <>
            {municipality ? <Badge tone="primary">{municipality}</Badge> : null}
            <Badge>{role}</Badge>
          </>
        }
      />

      {seesReports ? (
        // No metric is shown until real data exists (Phase 2.8): every value is an em dash.
        <section className="animate-enter overflow-clip card" aria-label={t('adminNav.reports')}>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {KPIS.map((kpi, index) => (
              <div
                key={kpi.label}
                // Hairlines between cells: stacked on phones, 2×2 on tablets, one row on desktop.
                className={cn(
                  'border-border p-5',
                  index > 0 && 'max-sm:border-t',
                  index % 2 === 1 && 'sm:border-s',
                  index >= 2 && 'sm:max-xl:border-t',
                  index === 2 && 'xl:border-s',
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Icon name={kpi.icon} className="size-4 text-subtle" />
                  {t(kpi.label)}
                </div>
                <p className="mt-3 text-3xl leading-none font-semibold tracking-tight text-subtle tabular-nums">
                  —
                </p>
                <p className="mt-2.5 text-xs text-muted">{t('adminOverview.kpiUnavailable')}</p>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 border-t border-border bg-surface-subtle px-5 py-2.5 text-sm text-muted">
            <Icon name="info" className="size-4 text-subtle" />
            {t('adminOverview.noData')}
          </p>
        </section>
      ) : (
        <Alert tone="info">{t('adminAuth.platformNoMunicipality')}</Alert>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="overview-modules" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="overview-modules" className="text-base font-semibold text-foreground">
                {t('adminOverview.modules')}
              </h2>
              <p className="text-sm text-muted">{t('adminOverview.modulesHint')}</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {modules.map((entry) => (
              <li key={entry.id} className="flex">
                <Link
                  href={localizedHref(locale, entry.path)}
                  className={cn(
                    'group flex w-full flex-col card p-4',
                    'transition-[border-color,box-shadow,transform] duration-150 ease-standard',
                    'hover:border-border-strong hover:shadow-sm',
                    'focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none',
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-foreground-secondary transition-colors duration-150 group-hover:border-primary-soft-border group-hover:bg-primary-soft group-hover:text-accent">
                      <Icon name={entry.icon} className="size-[18px]" />
                    </span>
                    <Badge size="sm" className="mt-0.5">
                      {t('adminPlaceholder.phase', { phase: entry.phase })}
                    </Badge>
                  </span>
                  <span className="mt-3 flex items-center gap-1.5 font-medium text-foreground">
                    {t(entry.label)}
                    <Icon
                      name="arrowEnd"
                      className="size-3.5 text-subtle opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 rtl:group-hover:-translate-x-0.5"
                    />
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-muted">
                    {t(moduleDescriptionKey(entry.id))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-6">
          <Panel title={t('adminAuth.municipality')} icon="departments">
            <DescriptionList
              items={[
                {
                  label: t('adminAuth.municipality'),
                  value: municipality ?? t('adminAuth.platformAdmin'),
                },
                {
                  label: t('adminEmployees.columns.role'),
                  value: <Badge tone="primary">{role}</Badge>,
                },
              ]}
            />
          </Panel>

          {seesReports ? (
            <Panel
              title={t('adminOverview.statusWorkflow')}
              description={t('adminOverview.statusWorkflowHint')}
              icon="layers"
            >
              <ol className="relative space-y-3 before:absolute before:inset-y-2.5 before:start-[5px] before:w-px before:bg-border">
                {REPORT_STATUSES.map((status) => (
                  <li key={status} className="relative flex items-center gap-3">
                    <span
                      aria-hidden
                      className="relative z-10 size-[11px] shrink-0 rounded-full border-2 border-surface bg-border-strong"
                    />
                    <ReportStatusBadge status={status} label={t(`reportStatus.${status}`)} />
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
