import Ionicons from '@expo/vector-icons/Ionicons';
import { attachReportPhoto, submitReport } from '@smart-city/api';
import { radii, REPORT_VISIBILITIES, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Image } from 'expo-image';
import { router, Stack, type Href } from 'expo-router';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Notice } from '@/components/report/notice';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { readPhotoBytes } from '@/lib/device-photos';
import { localizedName, useMunicipalities } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import {
  effectiveVisibility,
  firstInvalidStep,
  photoProgress,
  type DraftPhoto,
  type ReportDraft,
  type ReportStep,
} from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';
import { sendReport, type SendProgress, type SubmissionServices } from '@/lib/report-submission';
import { getSupabase } from '@/lib/supabase';

const SERVICES: SubmissionServices = { submitReport, attachReportPhoto, readPhotoBytes };

const STEP_HREF: Record<Exclude<ReportStep, 'review'>, Href> = {
  category: '/new-report/category',
  details: '/new-report/details',
  location: '/new-report/location',
  photos: '/new-report/photos',
};

/** Returns to an earlier step already in the stack, so Continue leads back here. */
function editStep(step: Exclude<ReportStep, 'review'>) {
  router.dismissTo(STEP_HREF[step]);
}

function Section({
  label,
  onEdit,
  children,
}: PropsWithChildren<{ label: string; onEdit?: () => void }>) {
  const { t } = useI18n();
  const colors = useThemeColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Text variant="caption" muted>
          {label}
        </Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`${t('reportFlow.edit')}: ${label}`}
            hitSlop={8}
          >
            <Text variant="caption" style={[styles.edit, { color: colors.primary }]}>
              {t('reportFlow.edit')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function PhotoRow({ photo, index, sent }: { photo: DraftPhoto; index: number; sent: boolean }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const status: {
    key: MessageKey;
    color: string;
    icon: 'checkmark-circle' | 'alert-circle' | 'time-outline';
  } | null = !sent
    ? null
    : photo.registered
      ? { key: 'reportFlow.photoAttached', color: colors.primary, icon: 'checkmark-circle' }
      : photo.error
        ? { key: 'reportFlow.photoNotAttached', color: colors.danger, icon: 'alert-circle' }
        : { key: 'reportFlow.photoWaiting', color: colors.textMuted, icon: 'time-outline' };
  return (
    <View style={styles.photoRow}>
      <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
      <View style={styles.flex}>
        <Text>{t('reportFlow.photoNumber', { number: index + 1 })}</Text>
        {photo.error && !photo.registered ? (
          <Text variant="caption" style={{ color: colors.danger }}>
            {t(photo.error)}
          </Text>
        ) : null}
      </View>
      {status ? (
        <View style={styles.inline}>
          <Ionicons name={status.icon} size={18} color={status.color} />
          <Text variant="caption" style={{ color: status.color }}>
            {t(status.key)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Android back button while the review is locked: ignored during sending; once the report
 * exists it leaves the flow to Home (the draft stays, so the Report tab offers to finish the
 * photos) instead of returning to steps that can no longer be edited.
 */
function useLockedBack(locked: boolean, sending: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !locked) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!sending) router.dismissTo('/');
      return true;
    });
    return () => subscription.remove();
  }, [locked, sending]);
}

function progressText(t: ReturnType<typeof useI18n>['t'], progress: SendProgress | null) {
  if (!progress || progress.phase === 'report') return t('reportFlow.sendingReport');
  return t('reportFlow.uploadingPhoto', { current: progress.current, total: progress.total });
}

/**
 * Step 5: review and send. The report is created once; photos are attached one by one and can
 * be retried without creating the report or uploading a stored photo again (see sendReport).
 */
export default function ReviewStep() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { draft, apply, dispatch, getDraft } = useReportDraft();
  const municipalities = useMunicipalities();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const inFlight = useRef(false);

  const sent = draft.submission !== null;
  const locked = sending || sent;
  useLockedBack(locked, sending);
  const missing = sent ? null : firstInvalidStep(draft);
  const visibility = effectiveVisibility(draft);
  const photos = photoProgress(draft);
  const pending = draft.photos.filter((photo) => !photo.registered);
  const canRetry = pending.some((photo) => photo.retryable);
  const municipality =
    municipalities.status === 'success'
      ? municipalities.data.find((item) => item.id === draft.municipalityId)
      : undefined;

  async function finish(current: ReportDraft) {
    const submission = current.submission;
    if (!submission) return;
    router.replace({
      pathname: '/new-report/success',
      params: {
        trackingNumber: submission.trackingNumber,
        photos: String(photoProgress(current).registered),
      },
    });
    await apply({ type: 'reset' });
  }

  async function handleSend() {
    if (inFlight.current || missing) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      const outcome = await sendReport(getSupabase(), getDraft(), apply, SERVICES, setProgress);
      if (outcome.kind === 'not_sent') setError(outcome.error);
      // The store holds the latest saved state (with every attached photo).
      else if (outcome.kind === 'sent') await finish(getDraft());
    } catch {
      setError('reportFlow.submitError');
    } finally {
      inFlight.current = false;
      setSending(false);
      setProgress(null);
    }
  }

  const footer = !sent ? (
    <Button
      title={sending ? progressText(t, progress) : t('reportFlow.submit')}
      onPress={() => void handleSend()}
      loading={sending}
      disabled={missing !== null}
    />
  ) : (
    <>
      {pending.length > 0 && (canRetry || sending) ? (
        <Button
          title={
            sending
              ? progressText(t, progress)
              : photos.failed > 0
                ? t('reportFlow.retryPhotos')
                : t('reportFlow.finishSendingPhotos')
          }
          onPress={() => void handleSend()}
          loading={sending}
        />
      ) : null}
      <Button
        title={pending.length > 0 ? t('reportFlow.finishWithoutPhotos') : t('reportFlow.done')}
        variant={pending.length > 0 && canRetry ? 'secondary' : 'primary'}
        onPress={() => void finish(draft)}
        disabled={sending}
      />
    </>
  );

  return (
    <>
      {/*
        No way back to the steps while sending, or once the report exists (its content is
        final): no back arrow (headerLeft also covers the web header), no swipe-back. Android's
        back button is handled by useLockedBack.
      */}
      <Stack.Screen
        options={{
          headerBackVisible: !locked,
          headerLeft: locked ? () => null : undefined,
          gestureEnabled: !locked,
        }}
      />
      <StepScreen
        step={sent ? undefined : 'review'}
        title={
          !sent
            ? t('reportFlow.reviewTitle')
            : photos.failed > 0 && !sending
              ? photos.total === 1
                ? t('reportFlow.partialTitleOne')
                : t('reportFlow.partialTitle')
              : t('reportFlow.unfinishedTitle')
        }
        hint={sent ? undefined : t('reportFlow.reviewHint')}
        footer={footer}
      >
        {sent ? (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text variant="caption" muted>
              {t('reportFlow.trackingNumberLabel')}
            </Text>
            <Text variant="heading" selectable style={styles.ltr}>
              {draft.submission!.trackingNumber}
            </Text>
            {sending ? null : photos.failed > 0 ? (
              <Text>
                {photos.total === 1
                  ? t('reportFlow.partialDescriptionOne')
                  : t('reportFlow.partialDescription', {
                      failed: pending.length,
                      total: photos.total,
                    })}
              </Text>
            ) : pending.length > 0 ? (
              <Text>{t('reportFlow.unfinishedDescription')}</Text>
            ) : null}
          </View>
        ) : null}

        {missing ? <Notice tone="error" message={t('reportFlow.errors.fixBeforeSubmit')} /> : null}
        {error ? <Notice tone="error" message={t(error)} /> : null}
        {sending ? (
          <Notice icon="cloud-upload-outline" message={t('reportFlow.keepAppOpen')} />
        ) : null}
        {sent && !sending ? <Notice message={t('reportFlow.reportLocked')} /> : null}

        {!sent ? (
          <>
            <Section
              label={t('reportFlow.municipalityLabel')}
              onEdit={sending ? undefined : () => editStep('category')}
            >
              <Text>{municipality ? localizedName(municipality.name, locale) : '—'}</Text>
            </Section>

            <Section
              label={t('reportFlow.categoryLabel')}
              onEdit={sending ? undefined : () => editStep('category')}
            >
              {draft.category ? (
                <View style={styles.inline}>
                  <Ionicons
                    name={CATEGORY_ICONS[draft.category]}
                    size={20}
                    color={colors.primary}
                  />
                  <Text>{t(`reportCategory.${draft.category}`)}</Text>
                </View>
              ) : (
                <Text style={{ color: colors.danger }}>
                  {t('reportFlow.errors.categoryRequired')}
                </Text>
              )}
            </Section>

            <Section
              label={t('reportFlow.descriptionLabel')}
              onEdit={sending ? undefined : () => editStep('details')}
            >
              {draft.description.trim() ? (
                <Text>{draft.description.trim()}</Text>
              ) : (
                <Text style={{ color: colors.danger }}>
                  {t('reportFlow.errors.descriptionTooShort')}
                </Text>
              )}
            </Section>

            <Section
              label={t('reportFlow.locationLabel')}
              onEdit={sending ? undefined : () => editStep('location')}
            >
              {draft.location ? (
                <View style={styles.inline}>
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
                  <View style={styles.flex}>
                    {draft.address.trim() ? <Text>{draft.address.trim()}</Text> : null}
                    <Text variant="caption" muted style={styles.ltr}>
                      {`${draft.location.latitude.toFixed(5)}, ${draft.location.longitude.toFixed(5)}`}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.danger }}>
                  {t('reportFlow.errors.locationRequired')}
                </Text>
              )}
            </Section>
          </>
        ) : null}

        <Section
          label={t('reportFlow.photosLabel')}
          onEdit={sending || sent ? undefined : () => editStep('photos')}
        >
          {draft.photos.length > 0 ? (
            draft.photos.map((photo, index) => (
              <PhotoRow key={photo.id} photo={photo} index={index} sent={sent} />
            ))
          ) : (
            <Text muted>{t('reportFlow.noPhotos')}</Text>
          )}
        </Section>

        {!sent ? (
          <View style={styles.visibility} accessibilityRole="radiogroup">
            <Text variant="caption" muted>
              {t('reportFlow.visibilityLabel')}
            </Text>
            {REPORT_VISIBILITIES.map((option) => {
              const selected = visibility === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => dispatch({ type: 'setVisibility', visibility: option })}
                  disabled={sending}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: sending }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={styles.flex}>{t(`reportVisibility.${option}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </StepScreen>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  edit: { fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1, gap: 2 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 48, height: 48, borderRadius: radii.sm },
  // Tracking numbers and coordinates are Latin/digits: left-to-right in Hebrew and Arabic too.
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start' },
  visibility: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
  },
});
