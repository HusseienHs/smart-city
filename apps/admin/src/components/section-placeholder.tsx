import { DEFAULT_LOCALE } from '@smart-city/shared';
import { translate, type MessageKey } from '@smart-city/shared/i18n';

import { EmptyState } from './empty-state';
import { PageHeader } from './page-header';

/** Placeholder for dashboard sections that are scheduled for later phases. */
export function SectionPlaceholder({ titleKey }: { titleKey: MessageKey }) {
  return (
    <>
      <PageHeader title={translate(DEFAULT_LOCALE, titleKey)} />
      <EmptyState
        title={translate(DEFAULT_LOCALE, 'common.comingSoon')}
        description={translate(DEFAULT_LOCALE, 'common.emptyTitle')}
      />
    </>
  );
}
