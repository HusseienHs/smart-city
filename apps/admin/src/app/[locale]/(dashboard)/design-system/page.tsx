import { REPORT_PRIORITIES, REPORT_STATUSES } from '@smart-city/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { ReportStatusBadge } from '@/components/report-status-badge';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SearchInput, Select, TextInput } from '@/components/ui/field';
import { KpiTile } from '@/components/ui/kpi-tile';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { getTranslator } from '@/lib/i18n/server';

/**
 * Internal component reference for developers and design review. Development builds only:
 * production builds answer 404, and the page is not in the navigation. Product strings come
 * from the real translations; the section labels are internal and English-only.
 */

export const metadata: Metadata = { title: 'Design system' };

const TONES: readonly BadgeTone[] = [
  'neutral',
  'primary',
  'info',
  'success',
  'warning',
  'danger',
  'violet',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="flex flex-col gap-5">{children}</div>
    </Panel>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export default async function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const t = await getTranslator();

  return (
    <>
      <PageHeader
        eyebrow="Internal"
        title="Design system"
        description="Tokens and components of the admin dashboard. Switch the language to review RTL and LTR."
        meta={<Badge tone="warning">Development only</Badge>}
      />

      <div className="flex flex-col gap-6">
        <Section title="Buttons">
          <Row>
            <Button variant="primary" icon="plus">
              Primary
            </Button>
            <Button variant="secondary" icon="filter">
              Secondary
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>
          <Row>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button variant="secondary" iconOnly icon="settings" aria-label="Settings" />
            <Button variant="ghost" iconOnly icon="search" aria-label={t('common.search')} />
          </Row>
        </Section>

        <Section title="Badges">
          <Row>
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone} dot>
                {tone}
              </Badge>
            ))}
          </Row>
          <Row>
            {REPORT_STATUSES.map((status) => (
              <ReportStatusBadge key={status} status={status} label={t(`reportStatus.${status}`)} />
            ))}
          </Row>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label={t('common.search')} hint="Hint text under the control.">
              {({ id, describedBy }) => (
                <SearchInput
                  id={id}
                  aria-describedby={describedBy}
                  placeholder={t('common.search')}
                />
              )}
            </Field>
            <Field label="Text input" error={t('apiErrors.validation')}>
              {({ id, describedBy, invalid }) => (
                <TextInput id={id} aria-describedby={describedBy} invalid={invalid} />
              )}
            </Field>
            <Field label="Select">
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} defaultValue="normal">
                  {REPORT_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {t(`reportPriority.${priority}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Section>

        <Section title="KPI tiles">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label={t('adminOverview.totalReports')}
              value={null}
              icon="reports"
              hint={t('adminOverview.kpiUnavailable')}
            />
            <KpiTile label="Loading" value={null} hint={<Skeleton className="h-4 w-24" />} />
          </div>
        </Section>

        <Panel
          title="Table"
          description="Empty and loading states. Rows come from real data only."
          flush
        >
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>#</TableHeaderCell>
                <TableHeaderCell>{t('adminNav.reports')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNav.departments')}</TableHeaderCell>
                <TableHeaderCell>{t('adminNav.employees')}</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {[0, 1, 2].map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border">
            <EmptyState
              icon="reports"
              title={t('common.emptyTitle')}
              description={t('common.noResults')}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
