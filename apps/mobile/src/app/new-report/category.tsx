import Ionicons from '@expo/vector-icons/Ionicons';
import { elevation, radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadError, LoadingState } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Notice } from '@/components/report/notice';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { localizedName, useCities } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { validateStep } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';
import { useHomeMunicipalityId, useReportCategories } from '@/lib/report-options';

/**
 * Step 1: one of the categories of the user's city. Reports always go to the city chosen at
 * sign-up; it can only be changed in the profile (Personal details).
 */
export default function CategoryStep() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { draft, dispatch } = useReportDraft();
  const [errors, setErrors] = useState<{ municipality?: MessageKey; category?: MessageKey }>({});
  const cities = useCities();
  const home = useHomeMunicipalityId(user?.id ?? null);
  const homeId = home.status === 'success' ? home.data : undefined;
  const categories = useReportCategories(draft.municipalityId);

  // The report always goes to the home city (also replacing a city kept in an older draft).
  useEffect(() => {
    if (draft.submission || homeId === undefined) return;
    if (draft.municipalityId !== homeId)
      dispatch({ type: 'setMunicipality', municipalityId: homeId });
  }, [homeId, draft.municipalityId, draft.submission, dispatch]);

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

  const city =
    homeId && cities.status === 'success' ? cities.data.find((item) => item.id === homeId) : null;
  const cityName = city
    ? localizedName(city.name, locale)
    : home.status === 'loading' || cities.status === 'loading'
      ? t('common.loading')
      : null;

  return (
    <StepScreen
      step="category"
      title={t('reportFlow.categoryTitle')}
      hint={t('reportFlow.categoryHint')}
      footer={
        <Button
          title={t('reportFlow.next')}
          onPress={handleNext}
          disabled={!homeId || categories.status !== 'success' || categories.data.length === 0}
        />
      }
    >
      <View style={styles.municipality}>
        {home.status === 'error' ? (
          <LoadError error={home.error} onRetry={home.reload} />
        ) : home.status === 'success' && !homeId ? (
          <>
            <Notice tone="error" message={t('reportFlow.noHomeCity')} />
            <Button
              title={t('reportFlow.setCity')}
              variant="soft"
              onPress={() => router.push('/account/details')}
            />
          </>
        ) : (
          <View
            style={[
              styles.cityRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <View style={styles.flex}>
              <Text variant="caption" muted>
                {t('reportFlow.municipalityLabel')}
              </Text>
              <Text style={styles.cityName}>{cityName ?? '—'}</Text>
            </View>
          </View>
        )}
        {homeId ? (
          <Text variant="caption" muted>
            {t('reportFlow.municipalityHint')}
          </Text>
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
                    backgroundColor: selected ? colors.primarySoft : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    shadowColor: colors.shadow,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: selected ? colors.primary : colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name={CATEGORY_ICONS[category]}
                    size={26}
                    color={selected ? colors.onPrimary : colors.primary}
                  />
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
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cityName: { fontWeight: '600' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    ...elevation.sm,
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
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
