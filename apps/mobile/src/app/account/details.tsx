import { getMyPhone, getMyProfile, type MyProfile } from '@smart-city/api';
import { spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadError, LoadingState } from '@/components/load-state';
import { OptionPicker } from '@/components/option-picker';
import { Notice } from '@/components/report/notice';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { localizedName, municipalityOptions, useCities, useNeighborhoods } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import {
  savePersonalDetails,
  toPersonalDetails,
  validatePersonalDetails,
  type PersonalDetails,
  type PersonalDetailsErrors,
} from '@/lib/personal-details';
import { getSupabase } from '@/lib/supabase';

interface LoadedDetails {
  profile: MyProfile | null;
  phone: string | null;
}

async function loadDetails(): Promise<LoadedDetails> {
  const client = getSupabase();
  const [profile, phone] = await Promise.all([getMyProfile(client), getMyPhone(client)]);
  return { profile, phone };
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.field, { borderBottomColor: colors.border }]}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Personal details: full name, email (read-only), phone, home municipality and neighborhood —
 * exactly the fields the database supports — loaded and saved through @smart-city/api.
 */
export default function PersonalDetailsScreen() {
  const { user } = useAuth();
  const details = useAsync<LoadedDetails>(user?.id ?? null, loadDetails);

  if (!user) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SignInRequired />
      </ScrollView>
    );
  }
  if (details.status !== 'success') {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        {details.status === 'loading' ? (
          <LoadingState />
        ) : (
          <LoadError error={details.error} onRetry={details.reload} />
        )}
      </ScrollView>
    );
  }
  return <DetailsForm email={user.email ?? '—'} loaded={details.data} onSaved={details.refresh} />;
}

function DetailsForm({
  email,
  loaded,
  onSaved,
}: {
  email: string;
  loaded: LoadedDetails;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const current = toPersonalDetails(loaded.profile, loaded.phone);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonalDetails>(current);
  const [errors, setErrors] = useState<PersonalDetailsErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const shown = editing ? form : current;

  const municipalities = useCities();
  const neighborhoods = useNeighborhoods(shown.homeMunicipalityId);
  const cityOptions =
    municipalities.status === 'success' ? municipalityOptions(municipalities.data, locale) : [];
  const neighborhoodOptions =
    neighborhoods.status === 'success'
      ? neighborhoods.data.map((n) => ({ id: n.id, label: localizedName(n.name, locale) }))
      : [];
  const nameOf = (options: { id: string; label: string }[], id: string | null) =>
    id ? (options.find((option) => option.id === id)?.label ?? '…') : t('profile.notSet');

  function startEditing() {
    setForm(current);
    setErrors({});
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  }

  async function handleSave() {
    const next = validatePersonalDetails(form);
    setErrors(next);
    setSaveError(null);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const result = await savePersonalDetails(getSupabase(), loaded.phone, form);
    setSaving(false);
    if (!result.ok) {
      // Keep the form open so the user can fix or retry; refresh what was saved, if anything.
      setSaveError(result.error);
      if (result.profileSaved) onSaved();
      return;
    }
    setEditing(false);
    setSaved(true);
    onSaved();
  }

  const listError = (retry: () => void) => ({
    message: t('profile.loadError'),
    retryLabel: t('common.retry'),
    onRetry: retry,
  });

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {saved ? <Notice message={t('profile.saved')} icon="checkmark-circle-outline" /> : null}

      {editing ? (
        <View style={styles.form}>
          <TextField
            label={t('profile.fullName')}
            value={form.fullName}
            onChangeText={(fullName) => {
              setForm({ ...form, fullName });
              setErrors({ ...errors, fullName: undefined });
            }}
            error={errors.fullName && t(errors.fullName)}
            autoComplete="name"
            textContentType="name"
          />
          <Field label={t('profile.email')} value={email} hint={t('profile.emailReadOnly')} />
          <TextField
            label={`${t('profile.phone')} · ${t('profile.phoneOptional')}`}
            placeholder={t('profile.phonePlaceholder')}
            value={form.phone}
            onChangeText={(phone) => {
              setForm({ ...form, phone });
              setErrors({ ...errors, phone: undefined });
            }}
            error={errors.phone && t(errors.phone)}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <OptionPicker
            label={t('profile.homeMunicipality')}
            value={form.homeMunicipalityId}
            options={cityOptions}
            onChange={(id) =>
              setForm({ ...form, homeMunicipalityId: id, homeNeighborhoodId: null })
            }
            placeholder={t('profile.notSet')}
            noneLabel={t('profile.none')}
            search={{ placeholder: t('common.search'), noResults: t('common.noResults') }}
            loading={municipalities.status === 'loading'}
            error={municipalities.status === 'error' ? listError(municipalities.reload) : undefined}
          />
          <OptionPicker
            label={t('profile.homeNeighborhood')}
            value={form.homeNeighborhoodId}
            options={neighborhoodOptions}
            onChange={(id) => setForm({ ...form, homeNeighborhoodId: id })}
            placeholder={
              form.homeMunicipalityId ? t('profile.notSet') : t('profile.chooseMunicipalityFirst')
            }
            noneLabel={t('profile.none')}
            disabled={!form.homeMunicipalityId}
            loading={neighborhoods.status === 'loading'}
            error={neighborhoods.status === 'error' ? listError(neighborhoods.reload) : undefined}
          />
          {saveError ? <Notice tone="error" message={t(saveError)} /> : null}
          <Button
            title={saving ? t('profile.saving') : t('profile.save')}
            onPress={handleSave}
            loading={saving}
          />
          <Button
            title={t('auth.cancel')}
            variant="secondary"
            onPress={() => setEditing(false)}
            disabled={saving}
          />
        </View>
      ) : (
        <View>
          <Field label={t('profile.fullName')} value={current.fullName || t('profile.notSet')} />
          <Field label={t('profile.email')} value={email} />
          <Field label={t('profile.phone')} value={current.phone || t('profile.notSet')} />
          <Field
            label={t('profile.homeMunicipality')}
            value={nameOf(cityOptions, current.homeMunicipalityId)}
          />
          <Field
            label={t('profile.homeNeighborhood')}
            value={nameOf(neighborhoodOptions, current.homeNeighborhoodId)}
          />
          <View style={styles.actions}>
            <Button title={t('profile.edit')} variant="soft" onPress={startEditing} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  form: { gap: spacing.lg },
  field: { gap: 2, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  value: { fontSize: 17 },
  actions: { marginTop: spacing.lg },
});
