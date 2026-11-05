import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingState } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Screen } from '@/components/screen';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { isDraftStarted } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';

/** Entry point of the report flow (also reached from the home screen's report button). */
export default function ReportScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { draft, dispatch, restoring } = useReportDraft();
  const hasDraft = isDraftStarted(draft);
  const submission = draft.submission;

  return (
    <Screen title={t('mobileTabs.report')} subtitle={t('mobileScreens.reportSubtitle')}>
      {!user ? (
        <SignInRequired />
      ) : restoring ? (
        <LoadingState />
      ) : submission ? (
        // A sent report with photos still missing: finish it, never start it again.
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.inline}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.bold}>{t('reportFlow.unfinishedTitle')}</Text>
              <Text variant="caption" muted style={styles.ltr}>
                {submission.trackingNumber}
              </Text>
              <Text variant="caption" muted>
                {t('reportFlow.unfinishedDescription')}
              </Text>
            </View>
          </View>
          <Button
            title={t('reportFlow.finishSendingPhotos')}
            onPress={() => router.push('/new-report/review')}
          />
        </View>
      ) : hasDraft ? (
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.inline}>
            <Ionicons
              name={draft.category ? CATEGORY_ICONS[draft.category] : 'document-text-outline'}
              size={24}
              color={colors.primary}
            />
            <View style={styles.flex}>
              <Text style={styles.bold}>{t('reportFlow.continueDraft')}</Text>
              {draft.category ? (
                <Text variant="caption" muted>
                  {t(`reportCategory.${draft.category}`)}
                </Text>
              ) : null}
            </View>
          </View>
          <Button
            title={t('reportFlow.continueDraft')}
            onPress={() => router.push('/new-report/category')}
          />
          <Button
            title={t('reportFlow.startOver')}
            variant="secondary"
            onPress={() => {
              dispatch({ type: 'reset' });
              router.push('/new-report/category');
            }}
          />
        </View>
      ) : (
        <Button
          title={t('reportFlow.startReport')}
          onPress={() => router.push('/new-report/category')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start' },
});
