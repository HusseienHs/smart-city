import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { LoadingState } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Screen } from '@/components/screen';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { isDraftStarted, REPORT_STEPS } from '@/lib/report-draft';
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
        <Card>
          <View style={styles.inline}>
            <View style={[styles.icon, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.warning} />
            </View>
            <View style={styles.flex}>
              <Text variant="subheading">{t('reportFlow.unfinishedTitle')}</Text>
              <Text variant="caption" muted style={styles.ltr}>
                {submission.trackingNumber}
              </Text>
            </View>
          </View>
          <Text variant="caption" muted>
            {t('reportFlow.unfinishedDescription')}
          </Text>
          <Button
            title={t('reportFlow.finishSendingPhotos')}
            icon="cloud-upload-outline"
            onPress={() => router.push('/new-report/review')}
          />
        </Card>
      ) : hasDraft ? (
        <Card>
          <View style={styles.inline}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name={draft.category ? CATEGORY_ICONS[draft.category] : 'document-text-outline'}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.flex}>
              <Text variant="subheading">{t('reportFlow.continueDraft')}</Text>
              {draft.category ? (
                <Text variant="caption" muted>
                  {t(`reportCategory.${draft.category}`)}
                </Text>
              ) : null}
            </View>
          </View>
          <Button
            title={t('reportFlow.continueDraft')}
            icon="create-outline"
            onPress={() => router.push('/new-report/category')}
          />
          <Button
            title={t('reportFlow.startOver')}
            variant="ghost"
            onPress={() => {
              dispatch({ type: 'reset' });
              router.push('/new-report/category');
            }}
          />
        </Card>
      ) : (
        <>
          {/* What the flow looks like, so the user knows what to expect before starting. */}
          <Card>
            {REPORT_STEPS.map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primarySoft }]}>
                  <Text variant="label" style={{ color: colors.primary }}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.flex}>{t(`reportFlow.steps.${step}`)}</Text>
              </View>
            ))}
          </Card>
          <Button
            title={t('reportFlow.startReport')}
            icon="add-circle-outline"
            size="lg"
            onPress={() => router.push('/new-report/category')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start' },
});
