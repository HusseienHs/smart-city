import { describe, expect, it } from 'vitest';
import { createTranslator } from '@smart-city/shared/i18n';

import { reportLabels } from './labels';

const t = createTranslator('en');
const name = (en: string) => ({ he: `${en}-he`, en });

describe('reportLabels', () => {
  const labels = reportLabels(
    {
      departments: [
        { id: 'd1', name: name('Roads'), isActive: true },
        { id: 'd2', name: name('Parks'), isActive: false },
      ],
      neighborhoods: [{ id: 'n1', name: { he: 'צפון' }, isActive: true }],
      categories: [{ id: 'c1', code: 'pothole', name: name('Pothole') }],
    },
    [
      {
        employee_id: 'e1',
        full_name: 'Dana Levi',
        role: 'employee',
        department_id: 'd1',
        job_title: null,
      },
      {
        employee_id: 'e2',
        full_name: null,
        role: 'employee',
        department_id: 'd1',
        job_title: null,
      },
    ],
    'en',
    t,
  );

  it('names departments, marking inactive ones, and the intake queue', () => {
    expect(labels.department('d1')).toBe('Roads');
    expect(labels.department('d2')).toBe('Parks (inactive)');
    expect(labels.department(null)).toBe('Intake queue');
    expect(labels.department('missing')).toBe('—');
  });

  it('falls back to Hebrew for untranslated names', () => {
    expect(labels.neighborhood('n1')).toBe('צפון');
    expect(labels.neighborhood(null)).toBeNull();
  });

  it('names people only through active colleagues; others are former staff', () => {
    expect(labels.person(null)).toBe('Unassigned');
    expect(labels.person('e1')).toBe('Dana Levi');
    expect(labels.person('e2')).toBe('Staff member');
    expect(labels.author('gone')).toBe('Former staff member');
    expect(labels.author(null)).toBe('Former staff member');
  });
});
