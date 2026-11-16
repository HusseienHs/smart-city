import { REPORT_STATUSES, type ReportStatus } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import Link from 'next/link';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { REPORT_STATUS_TONES } from '@/components/report-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge, badgeDotClass } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';
import { KpiTile } from '@/components/ui/kpi-tile';
import { IconTile, Panel } from '@/components/ui/panel';
import { canAccessModule } from '@/lib/auth/permissions';
import { roleLabel } from '@/lib/auth/role-label';
import { requireStaff } from '@/lib/auth/staff-context';
import { cn } from '@/lib/cn';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { moduleDescriptionKey, NAV_GROUPS } from '@/lib/navigation';
import { canDraftAnnouncements } from '@/lib/notices/capabilities';
import { canManageDepartments, canManageStaff } from '@/lib/staff/capabilities';

const KPIS: readonly {
  label: MessageKey;
  icon: IconName;
  tone: 'info' | 'warning' | 'success' | 'violet';
}[] = [
  { label: 'adminOverview.totalReports', icon: 'reports', tone: 'info' },
  { label: 'adminOverview.pendingReports', icon: 'clock', tone: 'warning' },
  { label: 'adminOverview.resolvedReports', icon: 'checkCircle', tone: 'success' },
  { label: 'adminOverview.avgResolutionTime', icon: 'analytics', tone: 'violet' },
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
  const role = staff.role;
  const seesReports = canAccessModule(role, 'reports');
  const municipality = staff.active ? localizedText(staff.active.municipality_name, locale) : null;
  const roleName = roleLabel(t, role);
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date());

  // Only actions the role can actually take; each opens the real page.
  const actions: { href: string; label: string; description: string; icon: IconName }[] = [];
  if (seesReports) {
    actions.push({
      href: localizedHref(locale, '/reports'),
      label: t('adminNav.reports'),
      description: t('adminModules.reports'),
      icon: 'reports',
    });
  }
  if (staff.active) {
    if (
      canAccessModule(role, 'notices') &&
      canDraftAnnouncements(staff.active.role, staff.active.department_id)
    ) {
      actions.push({
        href: localizedHref(locale, '/notices/new'),
        label: t('adminNotices.newAnnouncement'),
        description: t('adminModules.notices'),
        icon: 'notices',
      });
    }
    if (canAccessModule(role, 'employees') && canManageStaff(role)) {
      actions.push({
        href: localizedHref(locale, '/employees/invitations'),
        label: t('adminEmployees.invite'),
        description: t('adminModules.employees'),
        icon: 'userPlus',
      });
    }
    if (canAccessModule(role, 'departments') && canManageDepartments(role)) {
      actions.push({
        href: localizedHref(locale, '/departments/new'),
        label: t('adminDepartments.newDepartment'),
        description: t('adminModules.departments'),
        icon: 'departments',
      });
    }
  }

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    modules: group.modules.filter(
      (entry) => entry.id !== 'overview' && canAccessModule(role, entry.id),
    ),
  })).filter((group) => group.modules.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: who and where, on the signature ink surface. */}
      <section className="relative isolate animate-enter overflow-hidden rounded-2xl ink-surface shadow-md">
        <div aria-hidden className="absolute inset-0 -z-10 grid-lines" />
        <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
          <div className="max-w-2xl min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
              <span className="inline-flex items-center gap-2 font-medium text-[#5eead4]">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#2dd4bf] opacity-60 [animation-duration:2.4s]" />
                  <span className="relative size-2 rounded-full bg-[#2dd4bf]" />
                </span>
                {t('adminNav.overview')}
              </span>
              <span aria-hidden className="text-white/25">
                /
              </span>
              <span>{today}</span>
            </p>
            <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.03em] text-white sm:text-4xl sm:leading-[2.75rem]">
              {municipality ?? t('adminAuth.platformAdmin')}
            </h1>
            <p className="mt-2 max-w-xl text-md leading-6 text-white/65">
              {t('adminOverview.subtitle')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur ring-inset">
                <Icon name="roles" className="size-3.5 text-[#5eead4]" />
                {roleName}
              </span>
              {municipality ? (
                <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur ring-inset">
                  <Icon name="departments" className="size-3.5 text-[#a5b4fc]" />
                  {municipality}
                </span>
              ) : null}
            </div>
            {seesReports ? (
              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link
                  href={localizedHref(locale, '/reports')}
                  className="group inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-base font-semibold text-[#0a1020] shadow-[0_8px_24px_-8px_rgb(45_212_191/0.6)] transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5eead4]"
                >
                  <Icon name="reports" className="size-4" />
                  {t('adminNav.reports')}
                  <Icon
                    name="arrowEnd"
                    className="size-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  />
                </Link>
                {canAccessModule(role, 'notices') ? (
                  <Link
                    href={localizedHref(locale, '/notices')}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-white/10 px-4 text-base font-medium text-white ring-1 ring-white/20 backdrop-blur transition-colors ring-inset hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5eead4]"
                  >
                    <Icon name="notices" className="size-4" />
                    {t('adminNav.notices')}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* The municipality emblem in orbit: decorative. */}
          <div aria-hidden className="relative mx-auto hidden size-56 shrink-0 lg:block">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-6 rounded-full border border-dashed border-white/15" />
            <div className="absolute inset-12 rounded-full border border-white/10 bg-white/[0.03]" />
            <span className="absolute start-1/2 top-3 size-2.5 rounded-full bg-[#2dd4bf] shadow-[0_0_14px_#2dd4bf]" />
            <span className="absolute start-4 bottom-10 size-2 rounded-full bg-[#818cf8] shadow-[0_0_12px_#818cf8]" />
            <span className="absolute end-6 top-1/2 size-1.5 rounded-full bg-white/70" />
            <div className="absolute inset-[4.5rem] flex items-center justify-center rounded-[22px] bg-gradient-to-br from-[#14b8a6] to-[#4f46e5] text-4xl font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_20px_40px_-12px_rgb(45_212_191/0.6)]">
              {municipality ? (
                (Array.from(municipality.trim())[0] ?? '·')
              ) : (
                <Icon name="roles" className="size-10" />
              )}
            </div>
          </div>
        </div>
      </section>

      {seesReports ? (
        // No metric is shown until real data exists (Phase 2.8): every value is an em dash.
        <section
          aria-label={t('adminNav.reports')}
          className="animate-enter [animation-delay:60ms]"
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {KPIS.map((kpi) => (
              <KpiTile
                key={kpi.label}
                label={t(kpi.label)}
                value={null}
                icon={kpi.icon}
                tone={kpi.tone}
                hint={t('adminOverview.kpiUnavailable')}
              />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 px-1 text-sm text-muted">
            <Icon name="info" className="size-4 text-subtle" />
            {t('adminOverview.noData')}
          </p>
        </section>
      ) : (
        <Alert tone="info">{t('adminAuth.platformNoMunicipality')}</Alert>
      )}

      <div className="grid animate-enter items-start gap-6 [animation-delay:120ms] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {seesReports ? <WorkflowPanel t={t} /> : null}

          <section aria-labelledby="overview-modules" className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-4 px-1">
              <div>
                <h2
                  id="overview-modules"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  {t('adminOverview.modules')}
                </h2>
                <p className="text-sm text-muted">{t('adminOverview.modulesHint')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.id} className="overflow-hidden card">
                  <p className="border-b border-border bg-surface-subtle px-5 py-2.5 eyebrow text-muted">
                    {t(group.label)}
                  </p>
                  <ul className="grid divide-border max-sm:divide-y sm:grid-cols-2 [&>li]:border-border sm:[&>li:nth-child(even)]:border-s sm:[&>li:nth-child(n+3)]:border-t">
                    {group.modules.map((entry) => (
                      <li key={entry.id} className="flex">
                        <Link
                          href={localizedHref(locale, entry.path)}
                          className="group flex w-full items-start gap-3.5 px-5 py-4 transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-foreground-secondary ring-1 ring-border transition-colors ring-inset group-hover:bg-primary-soft group-hover:text-accent group-hover:ring-primary-soft-border">
                            <Icon name={entry.icon} className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold text-foreground">
                                {t(entry.label)}
                              </span>
                              <Icon
                                name="arrowEnd"
                                className="size-3.5 shrink-0 text-subtle opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 rtl:group-hover:-translate-x-0.5"
                              />
                            </span>
                            <span className="mt-0.5 line-clamp-2 text-sm text-muted">
                              {t(moduleDescriptionKey(entry.id))}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-muted ring-1 ring-border ring-inset">
                            {entry.phase}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {actions.length > 0 ? (
            <Panel title={t('adminOverview.quickActions')} icon="bolt">
              <ul className="-mx-2 -mb-2 flex flex-col">
                {actions.map((action, index) => (
                  <li key={action.href}>
                    <Link
                      href={action.href}
                      className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                    >
                      <IconTile
                        icon={action.icon}
                        tone={index === 0 ? 'primary' : 'neutral'}
                        size="lg"
                        className="transition-transform group-hover:scale-105"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">
                          {action.label}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {action.description}
                        </span>
                      </span>
                      <Icon
                        name="chevronEnd"
                        className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <section className="overflow-hidden card" aria-labelledby="overview-workspace">
            <div className="relative h-16 bg-gradient-to-br from-primary-soft via-surface-subtle to-violet-soft">
              <div aria-hidden className="absolute inset-0 grid-dots opacity-60" />
            </div>
            <div className="-mt-8 px-5 pb-5">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8a6] to-[#4f46e5] text-xl font-semibold text-white shadow-md ring-4 ring-surface">
                {municipality ? (
                  (Array.from(municipality.trim())[0] ?? '·')
                ) : (
                  <Icon name="roles" className="size-6" />
                )}
              </span>
              <p className="mt-3 eyebrow text-muted">{t('adminAuth.municipality')}</p>
              <h2
                id="overview-workspace"
                className="mt-1 text-xl font-semibold tracking-tight text-foreground"
              >
                {municipality ?? t('adminAuth.platformAdmin')}
              </h2>
              <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{t('adminEmployees.columns.role')}</dt>
                  <dd>
                    <Badge tone="primary" dot>
                      {roleName}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <Link
                href={localizedHref(locale, '/account')}
                className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2.5 text-sm font-medium text-foreground ring-1 ring-border transition-colors ring-inset hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2">
                  <Icon name="account" className="size-4 text-muted" />
                  {t('adminNav.account')}
                </span>
                <Icon name="chevronEnd" className="size-4 text-subtle" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * The statuses a report moves through, as a connected pipeline; rejection is an exit lane.
 * Shows the workflow only: no counts until real statistics exist.
 */
function WorkflowPanel({ t }: { t: Awaited<ReturnType<typeof getTranslator>> }) {
  const flow = REPORT_STATUSES.filter((status) => status !== 'rejected');
  const exits = REPORT_STATUSES.filter((status) => status === 'rejected');
  return (
    <Panel
      title={t('adminOverview.statusWorkflow')}
      description={t('adminOverview.statusWorkflowHint')}
      icon="layers"
    >
      <ol className="relative mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
        {flow.map((status, index) => (
          <WorkflowStep
            key={status}
            status={status}
            step={index + 1}
            last={index === flow.length - 1}
            label={t(`reportStatus.${status}`)}
          />
        ))}
      </ol>
      {exits.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-subtle px-4 py-3">
          <Icon name="arrowDown" className="size-4 text-subtle" />
          {exits.map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <span
                className={cn('size-2 rounded-full', badgeDotClass(REPORT_STATUS_TONES[status]))}
              />
              {t(`reportStatus.${status}`)}
            </span>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function WorkflowStep({
  status,
  step,
  last,
  label,
}: {
  status: ReportStatus;
  step: number;
  last: boolean;
  label: string;
}) {
  const tone = REPORT_STATUS_TONES[status];
  return (
    <li className="relative flex items-center gap-3 lg:flex-col lg:items-start lg:gap-3 lg:pe-3">
      {/* The connector to the next step (desktop pipeline). */}
      {!last ? (
        <span
          aria-hidden
          className="absolute start-10 end-0 top-[18px] hidden h-px bg-gradient-to-r from-border-strong to-border lg:block rtl:bg-gradient-to-l"
        />
      ) : null}
      <span
        className={cn(
          'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-xs font-medium ring-1 ring-border-strong ring-inset',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute -end-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface',
            badgeDotClass(tone),
          )}
        />
        <span className="text-foreground-secondary">{step}</span>
      </span>
      <span className="text-sm leading-5 font-medium text-foreground">{label}</span>
    </li>
  );
}
