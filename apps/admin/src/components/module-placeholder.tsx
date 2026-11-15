import type { Metadata } from 'next';

import { ModuleGuard } from '@/components/module-guard';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getTranslator } from '@/lib/i18n/server';
import { getModule, moduleDescriptionKey, type ModuleId } from '@/lib/navigation';

/** Page title and description of a dashboard module, in the request's locale. */
export async function moduleMetadata(id: ModuleId): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t(getModule(id).label), description: t(moduleDescriptionKey(id)) };
}

/**
 * The page of a module that has not been built yet: its real title and purpose, and the
 * roadmap phase that delivers it. No sample or placeholder data is shown.
 */
export async function ModulePlaceholder({ module: id }: { module: ModuleId }) {
  const t = await getTranslator();
  const entry = getModule(id);

  return (
    <ModuleGuard module={id}>
      <PageHeader
        title={t(entry.label)}
        description={t(moduleDescriptionKey(id))}
        meta={<Badge>{t('adminPlaceholder.phase', { phase: entry.phase })}</Badge>}
      />
      <Panel>
        <EmptyState
          icon={entry.icon}
          title={t('adminPlaceholder.title')}
          description={t('adminPlaceholder.description', { phase: entry.phase })}
        >
          {entry.requiresBackend ? (
            <Badge tone="warning" dot>
              {t('adminPlaceholder.dependsOnBackend')}
            </Badge>
          ) : null}
        </EmptyState>
      </Panel>
    </ModuleGuard>
  );
}
