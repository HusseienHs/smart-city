import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useI18n } from '@/lib/i18n';

export default function ProfileScreen() {
  const { t } = useI18n();
  return (
    <Screen title={t('mobileTabs.profile')} subtitle={t('mobileScreens.profileSubtitle')}>
      <EmptyState
        icon="person-circle-outline"
        title={t('mobileScreens.profileEmpty')}
        description={t('common.comingSoon')}
      />
    </Screen>
  );
}
