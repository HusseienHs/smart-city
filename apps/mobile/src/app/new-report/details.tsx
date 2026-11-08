import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { DESCRIPTION_MAX_LENGTH, validateStep } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';

/** Step 2: description. */
export default function DetailsStep() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { draft, dispatch } = useReportDraft();
  const [error, setError] = useState<MessageKey | null>(null);
  const length = draft.description.trim().length;

  if (draft.submission) return <Redirect href="/new-report/review" />;

  function handleNext() {
    const errors = validateStep('details', draft);
    setError(errors.description ?? null);
    if (!errors.description) router.push('/new-report/location');
  }

  return (
    <StepScreen
      step="details"
      title={t('reportFlow.detailsTitle')}
      hint={t('reportFlow.detailsHint')}
      footer={<Button title={t('reportFlow.next')} onPress={handleNext} />}
    >
      {draft.category ? (
        <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={CATEGORY_ICONS[draft.category]} size={18} color={colors.primary} />
          <Text variant="caption" style={{ color: colors.primary }}>
            {t(`reportCategory.${draft.category}`)}
          </Text>
        </View>
      ) : null}

      <TextField
        label={t('reportFlow.descriptionLabel')}
        placeholder={t('reportFlow.descriptionPlaceholder')}
        value={draft.description}
        onChangeText={(description) => {
          dispatch({ type: 'setDescription', description });
          if (error) setError(null);
        }}
        error={error ? t(error) : undefined}
        multiline
        maxLength={DESCRIPTION_MAX_LENGTH + 50}
        autoCapitalize="sentences"
      />
      <Text
        variant="caption"
        muted
        style={[styles.counter, length > DESCRIPTION_MAX_LENGTH && { color: colors.danger }]}
      >
        {t('reportFlow.characterCount', { count: length, max: DESCRIPTION_MAX_LENGTH })}
      </Text>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  counter: { alignSelf: 'flex-end', marginTop: -spacing.sm },
});
