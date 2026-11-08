import { describe, expect, it } from 'vitest';

import {
  assignReportSchema,
  createReportSchema,
  emailOnlySchema,
  localizedTextSchema,
  PASSWORD_TOO_LONG_MESSAGE,
  reportPhotoSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from './validation';

const validReport = {
  municipalityId: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
  category: 'pothole',
  description: 'Deep pothole next to the bus stop',
  location: { latitude: 32.0853, longitude: 34.7818 },
};

describe('createReportSchema', () => {
  it('accepts a valid report', () => {
    expect(createReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('trims and requires a meaningful description', () => {
    const result = createReportSchema.safeParse({ ...validReport, description: '   short   ' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown categories', () => {
    expect(createReportSchema.safeParse({ ...validReport, category: 'aliens' }).success).toBe(
      false,
    );
  });

  it('rejects out-of-range coordinates', () => {
    const result = createReportSchema.safeParse({
      ...validReport,
      location: { latitude: 91, longitude: 34.7 },
    });
    expect(result.success).toBe(false);
  });
});

describe('reportPhotoSchema', () => {
  it('rejects oversized and non-image files', () => {
    expect(
      reportPhotoSchema.safeParse({ mimeType: 'image/jpeg', sizeBytes: 50_000_000 }).success,
    ).toBe(false);
    expect(
      reportPhotoSchema.safeParse({ mimeType: 'application/pdf', sizeBytes: 1000 }).success,
    ).toBe(false);
  });
});

describe('localizedTextSchema', () => {
  it('requires Hebrew and allows Arabic and English', () => {
    expect(localizedTextSchema.safeParse({ he: 'שלום', en: 'Hello' }).success).toBe(true);
    expect(localizedTextSchema.safeParse({ en: 'Hello' }).success).toBe(false);
    expect(localizedTextSchema.safeParse({ he: '   ' }).success).toBe(false);
  });

  it('rejects unknown languages and non-string values', () => {
    expect(localizedTextSchema.safeParse({ he: 'שלום', fr: 'Salut' }).success).toBe(false);
    expect(localizedTextSchema.safeParse({ he: 'שלום', en: 1 }).success).toBe(false);
  });
});

describe('assignReportSchema', () => {
  it('requires a department or an assignee', () => {
    const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
    expect(assignReportSchema.safeParse({ reportId }).success).toBe(false);
    expect(assignReportSchema.safeParse({ reportId, departmentId: reportId }).success).toBe(true);
  });
});

describe('auth schemas', () => {
  const signUp = {
    email: 'citizen@example.com',
    password: 'long-enough',
    fullName: 'Dana Levi',
    preferredLocale: 'he',
    homeMunicipalityId: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
  };

  it('trims emails and names', () => {
    const result = signUpSchema.parse({
      ...signUp,
      email: ' citizen@example.com ',
      fullName: '  Dana Levi ',
    });
    expect(result.email).toBe('citizen@example.com');
    expect(result.fullName).toBe('Dana Levi');
  });

  it('does not trim passwords', () => {
    expect(signInSchema.parse({ email: signUp.email, password: ' secret ' }).password).toBe(
      ' secret ',
    );
  });

  it('rejects malformed emails', () => {
    expect(emailOnlySchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@', password: 'x' }).success).toBe(false);
  });

  it('enforces the same password length for sign-up and password updates', () => {
    for (const [password, valid] of [
      ['a'.repeat(7), false],
      ['a'.repeat(8), true],
      ['a'.repeat(72), true],
      ['a'.repeat(73), false],
    ] as const) {
      expect(signUpSchema.safeParse({ ...signUp, password }).success).toBe(valid);
      expect(updatePasswordSchema.safeParse({ password }).success).toBe(valid);
    }
  });

  it('keeps the too_big code on an over-long password, with an identifiable message', () => {
    const result = updatePasswordSchema.safeParse({ password: 'a'.repeat(73) });
    expect(result.error?.issues[0]).toMatchObject({
      code: 'too_big',
      message: PASSWORD_TOO_LONG_MESSAGE,
    });
  });

  it('only accepts supported locales', () => {
    expect(signUpSchema.safeParse({ ...signUp, preferredLocale: 'fr' }).success).toBe(false);
  });

  it('requires a home city', () => {
    const { homeMunicipalityId: _omitted, ...withoutCity } = signUp;
    expect(signUpSchema.safeParse(withoutCity).success).toBe(false);
    expect(signUpSchema.safeParse({ ...signUp, homeMunicipalityId: 'haifa' }).success).toBe(false);
  });
});
