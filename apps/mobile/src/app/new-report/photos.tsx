import Ionicons from '@expo/vector-icons/Ionicons';
import { MAX_REPORT_PHOTOS, radii, spacing } from '@smart-city/shared';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/report/notice';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { pickPhotos, preparePhoto } from '@/lib/device-photos';
import { useI18n } from '@/lib/i18n';
import { formatFileSize, validateStep } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';

type Message = { text: string; tone: 'info' | 'error'; settings?: boolean };

/** Step 4: photos (optional), from the camera or the gallery, prepared on the device. */
export default function PhotosStep() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { draft, apply, dispatch } = useReportDraft();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const free = MAX_REPORT_PHOTOS - draft.photos.length;

  if (draft.submission) return <Redirect href="/new-report/review" />;

  async function handleAdd(source: 'camera' | 'library') {
    if (busy || free < 1) return;
    setMessage(null);
    // Must run directly from the press (required by browsers), so no await comes before it.
    const result = await pickPhotos(source, free);
    if (result.status === 'cancelled') return;
    if (result.status === 'denied') {
      setMessage({
        tone: 'error',
        text: t(source === 'camera' ? 'reportFlow.cameraDenied' : 'reportFlow.photosDenied'),
        settings: !result.canAskAgain,
      });
      return;
    }
    if (result.status === 'unavailable') {
      setMessage({
        tone: 'error',
        text: t(
          source === 'camera' ? 'reportFlow.cameraUnavailable' : 'reportFlow.photoProcessingError',
        ),
      });
      return;
    }

    setBusy(true);
    const images = result.images.slice(0, free);
    let failed = false;
    for (const image of images) {
      try {
        await apply({ type: 'addPhoto', photo: await preparePhoto(image) });
      } catch {
        failed = true;
      }
    }
    setBusy(false);
    if (failed) {
      setMessage({ tone: 'error', text: t('reportFlow.photoProcessingError') });
    } else if (result.images.length > images.length) {
      setMessage({
        tone: 'info',
        text: t('reportFlow.photosSkipped', { count: images.length, max: MAX_REPORT_PHOTOS }),
      });
    }
  }

  function handleNext() {
    const errors = validateStep('photos', draft);
    if (errors.photos) setMessage({ tone: 'error', text: t(errors.photos) });
    else router.push('/new-report/review');
  }

  return (
    <StepScreen
      step="photos"
      title={t('reportFlow.photosTitle')}
      hint={t('reportFlow.photosHint', { max: MAX_REPORT_PHOTOS })}
      footer={<Button title={t('reportFlow.next')} onPress={handleNext} disabled={busy} />}
    >
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title={t('reportFlow.takePhoto')}
            variant="soft"
            onPress={() => void handleAdd('camera')}
            disabled={busy || free < 1}
          />
        </View>
        <View style={styles.action}>
          <Button
            title={t('reportFlow.choosePhotos')}
            variant="soft"
            onPress={() => void handleAdd('library')}
            disabled={busy || free < 1}
          />
        </View>
      </View>

      <Text variant="caption" muted>
        {busy
          ? t('reportFlow.processingPhoto')
          : t('reportFlow.photoCount', { count: draft.photos.length, max: MAX_REPORT_PHOTOS })}
      </Text>

      {draft.photos.length > 0 ? (
        <View style={styles.grid}>
          {draft.photos.map((photo, index) => {
            const label = t('reportFlow.photoNumber', { number: index + 1 });
            return (
              <View key={photo.id} style={[styles.tile, { borderColor: colors.border }]}>
                <Image
                  source={{ uri: photo.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityLabel={label}
                />
                <View style={[styles.size, { backgroundColor: colors.surface }]}>
                  <Text variant="caption" style={styles.ltr}>
                    {formatFileSize(photo.sizeBytes)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => dispatch({ type: 'removePhoto', id: photo.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('reportFlow.removePhoto')}: ${label}`}
                  hitSlop={8}
                  style={[styles.remove, { backgroundColor: colors.surface }]}
                >
                  <Ionicons name="close" size={16} color={colors.danger} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Ionicons name="images-outline" size={36} color={colors.primary} />
          <Text muted style={styles.center}>
            {t('reportFlow.noPhotos')}
          </Text>
        </View>
      )}

      {message ? (
        <View style={styles.message}>
          <Notice tone={message.tone} message={message.text} />
          {message.settings ? (
            <Button
              title={t('reportFlow.openSettings')}
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </View>
      ) : null}

      <Notice icon="shield-checkmark-outline" message={t('reportFlow.photoPrivacy')} />
    </StepScreen>
  );
}

const TILE = 104;

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  size: {
    position: 'absolute',
    bottom: spacing.xs,
    start: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  remove: {
    position: 'absolute',
    top: spacing.xs,
    end: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  center: { textAlign: 'center' },
  // "19 KB": digits and a Latin unit, left-to-right in Hebrew and Arabic too.
  ltr: { writingDirection: 'ltr' },
  message: { gap: spacing.sm },
});
