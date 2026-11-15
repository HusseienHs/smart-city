import { REPORT_STATUSES } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import Link from 'next/link';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { ReportStatusBadge } from '@/components/report-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';
import { KpiTile } from '@/components/ui/kpi-tile';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { canAccessModule } from '@/lib/auth/permissions';
import { roleLabel } from '@/lib/auth/role-label';
import { requireStaff } from '@/lib/auth/staff-context';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { moduleDescriptionKey, NAV_MODULES } from '@/lib/navigation';

const KPIS: readonly { label: MessageKey; icon: IconName }[] = [
  { label: 'adminOverview.totalReports', icon: 'reports' },
  { label: 'adminOverview.pendingReports', icon: 'clock' },
  { label: 'adminOverview.resolvedReports', icon: 'check' },
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

  return (
    <>
      <PageHeader
        title={t('adminNav.overview')}
        description={t('adminOverview.subtitle')}
        meta={
          <>
            {staff.active ? (
              <Badge tone="primary">{localizedText(staff.active.municipality_name, locale)}</Badge>
            ) : null}
            <Badge>{roleLabel(t, staff.role)}</Badge>
          </>
        }
      />

      {seesReports ? (
        <>
          {/* No metric is shown until real data exists (Phase 2.8). */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPIS.map((kpi) => (
              <KpiTile
                key={kpi.label}
                label={t(kpi.label)}
                value={null}
                icon={kpi.icon}
                hint={t('adminOverview.kpiUnavailable')}
              />
            ))}
          </section>
          <p className="mt-3 text-sm text-muted">{t('adminOverview.noData')}</p>
        </>
      ) : (
        <Alert tone="info">{t('adminAuth.platformNoMunicipality')}</Alert>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={t('adminOverview.modules')}
          description={t('adminOverview.modulesHint')}
          flush
        >
          <ul className="divide-y divide-border">
            {modules.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={localizedHref(locale, entry.path)}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-subtle"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-foreground-secondary transition-colors group-hover:border-primary-soft-border group-hover:bg-primary-soft group-hover:text-primary">
                    <Icon name={entry.icon} className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{t(entry.label)}</span>
                    <span className="block truncate text-sm text-muted">
                      {t(moduleDescriptionKey(entry.id))}
                    </span>
                  </span>
                  <Badge className="max-sm:hidden">
                    {t('adminPlaceholder.phase', { phase: entry.phase })}
                  </Badge>
                  <Icon
                    name="chevronEnd"
                    className="size-4 text-subtle transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {seesReports ? (
          <Panel
            title={t('adminOverview.statusWorkflow')}
            description={t('adminOverview.statusWorkflowHint')}
          >
            <ul className="flex flex-wrap gap-2">
              {REPORT_STATUSES.map((status) => (
                <li key={status}>
                  <ReportStatusBadge status={status} label={t(`reportStatus.${status}`)} />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
