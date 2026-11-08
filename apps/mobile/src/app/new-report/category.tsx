import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadError, LoadingState } from '@/components/load-state';
import { OptionPicker } from '@/components/option-picker';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Notice } from '@/components/report/notice';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { apiErrorMessageKey } from '@/lib/api-error-message';
import { useAuth } from '@/lib/auth';
import {
  localizedName,
  municipalityOptions,
  useCities,
  useReportingMunicipalities,
} from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { validateStep } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';
import {
  homeCityNotJoined,
  useHomeMunicipalityId,
  useReportCategories,
} from '@/lib/report-options';

/** Step 1: municipality (the home municipality by default) and one of its categories. */
export default function CategoryStep() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { draft, dispatch } = useReportDraft();
  const [errors, setErrors] = useState<{ municipality?: MessageKey; category?: MessageKey }>({});
  /** The citizen chose a municipality themselves: don't apply the default over it. */
  const [picked, setPicked] = useState(false);
  const municipalities = useReportingMunicipalities();
  const cities = useCities();
  const home = useHomeMunicipalityId(user?.id ?? null);
  const categories = useReportCategories(draft.municipalityId);
  const active = municipalities.status === 'success' ? municipalities.data : null;

  // Default to the saved home municipality (only if it accepts reports), never to a guess.
  useEffect(() => {
    if (picked || draft.municipalityId || draft.submission || !active) return;
    if (home.status !== 'success') return;
    const homeId = home.data;
    if (homeId && active.some((municipality) => municipality.id === homeId)) {
      dispatch({ type: 'setMunicipality', municipalityId: homeId });
    }
  }, [picked, draft.municipalityId, draft.submission, active, home, dispatch]);

  // A category chosen earlier (or a shortcut) that this municipality doesn't offer is cleared.
  useEffect(() => {
    if (categories.status !== 'success' || !draft.category || draft.submission) return;
    if (!categories.data.includes(draft.category))
      dispatch({ type: 'setCategory', category: null });
  }, [categories, draft.category, draft.submission, dispatch]);

  if (draft.submission) return <Redirect href="/new-report/review" />;

  function handleNext() {
    const next = validateStep('category', draft);
    setErrors(next);
    if (Object.keys(next).length === 0) router.push('/new-report/details');
  }

  // The home city is on the list but hasn't joined: say why it wasn't preselected.
  const notJoinedHome = homeCityNotJoined(
    home.status === 'success' ? home.data : null,
    active,
    cities.status === 'success' ? cities.data : null,
  );

  const loadingDefault = municipalities.status === 'loading' || home.status === 'loading';

  return (
    <StepScreen
      step="category"
      title={t('reportFlow.categoryTitle')}
      hint={t('reportFlow.categoryHint')}
      footer={
        <Button
          title={t('reportFlow.next')}
          onPress={handleNext}
          disabled={categories.status !== 'success' || categories.data.length === 0}
        />
      }
    >
      <View style={styles.municipality}>
        <OptionPicker
          label={t('reportFlow.municipalityLabel')}
          value={draft.municipalityId}
          options={municipalityOptions(active ?? [], locale)}
          onChange={(municipalityId) => {
            dispatch({ type: 'setMunicipality', municipalityId });
            setPicked(true);
            setErrors({});
          }}
          placeholder={loadingDefault ? t('common.loading') : t('reportFlow.chooseMunicipality')}
          noneLabel={t('reportFlow.chooseMunicipality')}
          search={
            (active?.length ?? 0) > 12
              ? { placeholder: t('common.search'), noResults: t('common.noResults') }
              : undefined
          }
          loading={municipalities.status === 'loading'}
          error={
            municipalities.status === 'error'
              ? {
                  message: t(apiErrorMessageKey(municipalities.error)),
                  retryLabel: t('common.retry'),
                  onRetry: municipalities.reload,
                }
              : undefined
          }
        />
        <Text variant="caption" muted>
          {t('reportFlow.municipalityHint')}
        </Text>
        {active && active.length === 0 ? (
          <Notice tone="error" message={t('reportFlow.noMunicipalities')} />
        ) : notJoinedHome && !draft.municipalityId ? (
          <Notice
            message={t('reportFlow.homeCityNotJoined', {
              city: localizedName(notJoinedHome.name, locale),
            })}
          />
        ) : null}
        {errors.municipality ? <Notice tone="error" message={t(errors.municipality)} /> : null}
      </View>

      {!draft.municipalityId ? null : categories.status === 'loading' ? (
        <LoadingState />
      ) : categories.status === 'error' ? (
        <LoadError error={categories.error} onRetry={categories.reload} />
      ) : categories.data.length === 0 ? (
        <Notice message={t('reportFlow.noCategories')} />
      ) : (
        <View style={styles.grid} accessibilityRole="radiogroup">
          {categories.data.map((category) => {
            const selected = draft.category === category;
            const label = t(`reportCategory.${category}`);
            return (
              <Pressable
                key={category}
                onPress={() => {
                  dispatch({ type: 'setCategory', category });
                  setErrors({});
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={CATEGORY_ICONS[category]} size={26} color={colors.primary} />
                </View>
                <Text style={styles.label}>{label}</Text>
                {selected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                    style={styles.check}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {errors.category ? <Notice tone="error" message={t(errors.category)} /> : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  municipality: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center', fontWeight: '600' },
  check: { position: 'absolute', top: spacing.sm, end: spacing.sm },
  pressed: { opacity: 0.7 },
});
