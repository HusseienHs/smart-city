import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/report/notice';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useThemeColors } from '@/hooks/use-theme';
import { locateDevice, type LocateResult } from '@/lib/device-location';
import { useI18n } from '@/lib/i18n';
import { ADDRESS_MAX_LENGTH, validateStep, type DraftErrors } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';

type Problem = Exclude<LocateResult, { status: 'located' }>;

function problemMessage(problem: Problem): MessageKey {
  switch (problem.status) {
    case 'denied':
      return problem.canAskAgain
        ? 'reportFlow.locationPermissionNeeded'
        : 'reportFlow.locationDenied';
    case 'services_off':
      return 'reportFlow.locationServicesOff';
    case 'unavailable':
      return 'reportFlow.locationUnavailable';
  }
}

/** Step 3: the device's GPS position (required) and an optional typed address. */
export default function LocationStep() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { draft, dispatch } = useReportDraft();
  const [errors, setErrors] = useState<DraftErrors>({});
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const attempt = useRef(0);
  const { location } = draft;

  if (draft.submission) return <Redirect href="/new-report/review" />;

  async function handleLocate() {
    const current = ++attempt.current;
    setLocating(true);
    setProblem(null);
    const result = await locateDevice();
    if (current !== attempt.current) return;
    setLocating(false);
    if (result.status === 'located') {
      dispatch({ type: 'setLocation', location: result.location });
      setErrors((previous) => ({ ...previous, location: undefined }));
    } else {
      setProblem(result);
    }
  }

  function handleNext() {
    const next = validateStep('location', draft);
    setErrors(next);
    if (Object.keys(next).length === 0) router.push('/new-report/photos');
  }

  const needsSettings =
    problem !== null &&
    ((problem.status === 'denied' && !problem.canAskAgain) || problem.status === 'services_off');

  return (
    <StepScreen
      step="location"
      title={t('reportFlow.locationTitle')}
      hint={t('reportFlow.locationHint')}
      footer={<Button title={t('reportFlow.next')} onPress={handleNext} disabled={locating} />}
    >
      {/* No map provider yet (decision D-008): the captured point is shown as coordinates. */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: location ? colors.primarySoft : colors.surface,
            borderColor: location ? colors.primary : colors.border,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Ionicons
          name={location ? 'location' : 'locate-outline'}
          size={40}
          color={colors.primary}
        />
        {location ? (
          <>
            <Text style={styles.bold}>{t('reportFlow.locationSaved')}</Text>
            <Text variant="caption" muted style={styles.ltr} selectable>
              {`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
            </Text>
            {location.accuracy !== undefined ? (
              <Text variant="caption" muted>
                {t('reportFlow.accuracy', { meters: location.accuracy })}
              </Text>
            ) : null}
          </>
        ) : (
          <Text muted style={styles.center}>
            {locating ? t('reportFlow.locating') : t('reportFlow.locationHint')}
          </Text>
        )}
      </View>

      <Button
        title={
          locating
            ? t('reportFlow.locating')
            : location
              ? t('reportFlow.updateLocation')
              : t('reportFlow.useCurrentLocation')
        }
        variant={location ? 'secondary' : 'primary'}
        onPress={() => void handleLocate()}
        loading={locating}
      />

      {problem ? (
        <View style={styles.problem}>
          <Notice tone="error" message={t(problemMessage(problem))} />
          {needsSettings ? (
            <Button
              title={t('reportFlow.openSettings')}
              variant="soft"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </View>
      ) : null}
      {errors.location && !problem ? <Notice tone="error" message={t(errors.location)} /> : null}

      <Text variant="caption" muted>
        {t('reportFlow.locationPrivacy')}
      </Text>

      <TextField
        label={t('reportFlow.addressOptional')}
        placeholder={t('reportFlow.addressPlaceholder')}
        value={draft.address}
        onChangeText={(address) => {
          dispatch({ type: 'setAddress', address });
          if (errors.address) setErrors((previous) => ({ ...previous, address: undefined }));
        }}
        error={errors.address ? t(errors.address) : undefined}
        maxLength={ADDRESS_MAX_LENGTH + 20}
        autoCapitalize="sentences"
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bold: { fontWeight: '600' },
  center: { textAlign: 'center' },
  // Coordinates are digits: keep them left-to-right in Hebrew and Arabic.
  ltr: { writingDirection: 'ltr' },
  problem: { gap: spacing.sm },
});
