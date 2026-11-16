import type { Metadata } from 'next';

import { ModuleGuard } from '@/components/module-guard';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
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
      <section className="relative animate-enter overflow-clip card">
        {/* A faint dotted field: signals "not built yet" without imitating real content. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] [background-size:20px_20px] opacity-70"
        />
        <div className="relative flex flex-col items-center px-6 py-20 text-center">
          <span className="flex size-14 items-center justify-center rounded-xl border border-border bg-surface text-foreground-secondary shadow-sm">
            <Icon name={entry.icon} className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-foreground">
            {t('adminPlaceholder.title')}
          </h2>
          <p className="mt-1 max-w-md text-base text-muted">
            {t('adminPlaceholder.description', { phase: entry.phase })}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="primary" dot>
              {t('adminPlaceholder.phase', { phase: entry.phase })}
            </Badge>
            {entry.requiresBackend ? (
              <Badge tone="warning" dot>
                {t('adminPlaceholder.dependsOnBackend')}
              </Badge>
            ) : null}
          </div>
        </div>
      </section>
    </ModuleGuard>
  );
}
