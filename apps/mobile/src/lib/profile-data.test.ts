import { ApiError, type MyProfile } from '@smart-city/api';
import { messages } from '@smart-city/shared/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  updateMyProfile: vi.fn(),
  upsertMyPhone: vi.fn(),
  deleteMyPhone: vi.fn(),
}));

// The real package, with only the calls that would reach the network replaced.
vi.mock('@smart-city/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const { apiErrorMessageKey } = await import('./api-error-message');
const { formatReportDate, toReportCategory } = await import('./my-reports');
const {
  normalizePhone,
  phoneChange,
  savePersonalDetails,
  toPersonalDetails,
  toProfileUpdate,
  validatePersonalDetails,
} = await import('./personal-details');

const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const neighborhoodId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const client = {} as never;

const details = {
  fullName: 'Dana Levi',
  phone: '',
  homeMunicipalityId: null,
  homeNeighborhoodId: null,
};

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    return typeof node === 'object' && node !== null
      ? (node as Record<string, unknown>)[part]
      : undefined;
  }, messages.en);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.updateMyProfile.mockResolvedValue({});
  api.upsertMyPhone.mockResolvedValue('0501234567');
  api.deleteMyPhone.mockResolvedValue(undefined);
});

describe('personal details form', () => {
  it('starts from the loaded profile and phone (no invented values)', () => {
    const profile: MyProfile = {
      id: 'u',
      full_name: 'Dana Levi',
      preferred_locale: 'he',
      home_municipality_id: municipalityId,
      home_neighborhood_id: neighborhoodId,
    };
    expect(toPersonalDetails(profile, '+972501234567')).toEqual({
      fullName: 'Dana Levi',
      phone: '+972501234567',
      homeMunicipalityId: municipalityId,
      homeNeighborhoodId: neighborhoodId,
    });
    expect(toPersonalDetails(null, null)).toEqual({
      fullName: '',
      phone: '',
      homeMunicipalityId: null,
      homeNeighborhoodId: null,
    });
  });

  it('validates the name like sign-up and the phone like the database', () => {
    expect(validatePersonalDetails(details)).toEqual({});
    expect(validatePersonalDetails({ ...details, fullName: ' D ' }).fullName).toBe(
      'auth.errors.nameRequired',
    );
    for (const phone of ['050-123-4567', '+972 50 123 4567', '(03) 555.1234']) {
      expect(validatePersonalDetails({ ...details, phone })).toEqual({});
    }
    for (const phone of ['12345', '050-12a-4567', '1'.repeat(16)]) {
      expect(validatePersonalDetails({ ...details, phone }).phone).toBe(
        'profile.errors.phoneInvalid',
      );
    }
    expect(normalizePhone(' +972 50-123-4567 ')).toBe('+972501234567');
  });

  it('sends the municipality with the neighborhood, and never a lone neighborhood', () => {
    expect(
      toProfileUpdate({
        ...details,
        homeMunicipalityId: municipalityId,
        homeNeighborhoodId: neighborhoodId,
      }),
    ).toEqual({
      fullName: 'Dana Levi',
      homeMunicipalityId: municipalityId,
      homeNeighborhoodId: neighborhoodId,
    });
    expect(toProfileUpdate({ ...details, homeNeighborhoodId: neighborhoodId })).toEqual({
      fullName: 'Dana Levi',
      homeMunicipalityId: null,
      homeNeighborhoodId: null,
    });
  });

  it('decides whether the phone is kept, saved or removed', () => {
    expect(phoneChange('0501234567', '050-123-4567')).toEqual({ action: 'none' });
    expect(phoneChange(null, '')).toEqual({ action: 'none' });
    expect(phoneChange(null, '050 123 4567')).toEqual({ action: 'upsert', phone: '0501234567' });
    expect(phoneChange('0501234567', '  ')).toEqual({ action: 'delete' });
  });
});

describe('savePersonalDetails', () => {
  it('saves the profile and leaves an unchanged phone alone', async () => {
    await expect(savePersonalDetails(client, null, details)).resolves.toEqual({ ok: true });
    expect(api.updateMyProfile).toHaveBeenCalledWith(client, toProfileUpdate(details));
    expect(api.upsertMyPhone).not.toHaveBeenCalled();
    expect(api.deleteMyPhone).not.toHaveBeenCalled();
  });

  it('saves a new phone number, normalized', async () => {
    await savePersonalDetails(client, null, { ...details, phone: '050-123-4567' });
    expect(api.upsertMyPhone).toHaveBeenCalledWith(client, { phone: '0501234567' });
  });

  it('removes a cleared phone number', async () => {
    await savePersonalDetails(client, '0501234567', { ...details, phone: '' });
    expect(api.deleteMyPhone).toHaveBeenCalledWith(client);
  });

  it('stops at a failed profile save and reports the API reason', async () => {
    api.updateMyProfile.mockRejectedValue(new ApiError('network'));
    await expect(
      savePersonalDetails(client, null, { ...details, phone: '0501234567' }),
    ).resolves.toEqual({ ok: false, profileSaved: false, error: 'apiErrors.network' });
    expect(api.upsertMyPhone).not.toHaveBeenCalled();
  });

  it('reports a phone failure after the profile was saved', async () => {
    api.upsertMyPhone.mockRejectedValue(new ApiError('server'));
    await expect(
      savePersonalDetails(client, null, { ...details, phone: '0501234567' }),
    ).resolves.toEqual({ ok: false, profileSaved: true, error: 'profile.phoneSaveError' });
  });
});

describe('api error messages', () => {
  it('uses the ApiError translation key, or a generic one', () => {
    expect(apiErrorMessageKey(new ApiError('unauthorized'))).toBe('apiErrors.unauthorized');
    expect(apiErrorMessageKey(new ApiError('validation'))).toBe('apiErrors.validation');
    expect(apiErrorMessageKey(new Error('boom'))).toBe('apiErrors.server');
    expect(apiErrorMessageKey('weird')).toBe('apiErrors.server');
  });

  it('every key used exists in the translations', () => {
    for (const key of [
      'apiErrors.unauthorized',
      'apiErrors.network',
      'apiErrors.server',
      'profile.phoneSaveError',
      'profile.languageSyncError',
      'profile.signInRequiredTitle',
    ]) {
      expect(typeof lookup(key)).toBe('string');
    }
  });
});

describe('report display helpers', () => {
  it('maps unknown category codes to "other"', () => {
    expect(toReportCategory('pothole')).toBe('pothole');
    expect(toReportCategory('municipal_custom_code')).toBe('other');
  });

  it('formats dates for each locale and tolerates bad input', () => {
    const iso = '2026-11-05T10:00:00Z';
    expect(formatReportDate(iso, 'en')).toMatch(/2026/);
    expect(formatReportDate(iso, 'he')).toMatch(/2026/);
    expect(formatReportDate(iso, 'ar')).not.toBe('');
    expect(formatReportDate('not-a-date', 'en')).toBe('');
  });
});
