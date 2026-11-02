import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useI18n } from '@/lib/i18n';

export default function EventsScreen() {
  const { t } = useI18n();
  return (
    <Screen title={t('mobileTabs.events')} subtitle={t('mobileScreens.eventsSubtitle')}>
      <EmptyState
        icon="calendar-outline"
        title={t('mobileScreens.eventsEmpty')}
        description={t('common.comingSoon')}
      />
    </Screen>
  );
}
