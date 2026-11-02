import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useI18n } from '@/lib/i18n';

export default function ExploreScreen() {
  const { t } = useI18n();
  return (
    <Screen title={t('mobileTabs.explore')} subtitle={t('mobileScreens.exploreSubtitle')}>
      <EmptyState
        icon="map-outline"
        title={t('mobileScreens.exploreEmpty')}
        description={t('common.comingSoon')}
      />
    </Screen>
  );
}
