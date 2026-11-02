import { describe, expect, it } from 'vitest';

import { assignReportSchema, createReportSchema, reportPhotoSchema } from './validation';

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

describe('assignReportSchema', () => {
  it('requires a department or an assignee', () => {
    const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
    expect(assignReportSchema.safeParse({ reportId }).success).toBe(false);
    expect(assignReportSchema.safeParse({ reportId, departmentId: reportId }).success).toBe(true);
  });
});
