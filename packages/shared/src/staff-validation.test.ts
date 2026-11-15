import { describe, expect, it } from 'vitest';

import {
  departmentSchema,
  inviteStaffSchema,
  setEmployeeActiveSchema,
  setEmployeeRoleSchema,
  updateEmployeeJobTitleSchema,
} from './staff-validation';

const dept = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const emp = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const other = '4c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

describe('departmentSchema', () => {
  it('requires a Hebrew name and drops empty translations and contacts', () => {
    expect(
      departmentSchema.parse({
        name: { he: ' כבישים ', ar: '', en: 'Roads' },
        email: '',
        phone: '',
      }),
    ).toEqual({ name: { he: 'כבישים', ar: undefined, en: 'Roads' }, email: null, phone: null });
    expect(departmentSchema.safeParse({ name: { he: '  ', en: 'Roads' } }).success).toBe(false);
    expect(departmentSchema.safeParse({ name: { en: 'Roads' } }).success).toBe(false);
  });

  it('checks email and phone like the database', () => {
    const name = { he: 'כבישים' };
    expect(
      departmentSchema.safeParse({ name, email: 'roads@city.il', phone: '+972 3-123-4567' })
        .success,
    ).toBe(true);
    expect(departmentSchema.safeParse({ name, email: 'not an email' }).success).toBe(false);
    expect(departmentSchema.safeParse({ name, phone: '12' }).success).toBe(false);
    expect(departmentSchema.safeParse({ name, phone: 'call us' }).success).toBe(false);
  });

  it('rejects unknown fields and languages', () => {
    expect(departmentSchema.safeParse({ name: { he: 'א', fr: 'x' } }).success).toBe(false);
    expect(departmentSchema.safeParse({ name: { he: 'א' }, isActive: true }).success).toBe(false);
  });
});

describe('inviteStaffSchema', () => {
  it('normalizes the email the way the table requires', () => {
    expect(
      inviteStaffSchema.parse({ email: ' Dana@City.IL ', role: 'employee', departmentId: dept }),
    ).toEqual({ email: 'dana@city.il', role: 'employee', departmentId: dept, jobTitle: null });
  });

  it('requires a department for employees and managers, and none for other roles', () => {
    expect(
      inviteStaffSchema.safeParse({
        email: 'a@b.il',
        role: 'department_manager',
        departmentId: null,
      }).success,
    ).toBe(false);
    expect(
      inviteStaffSchema.safeParse({
        email: 'a@b.il',
        role: 'intake_dispatcher',
        departmentId: dept,
      }).success,
    ).toBe(false);
    expect(
      inviteStaffSchema.safeParse({
        email: 'a@b.il',
        role: 'municipality_admin',
        departmentId: null,
      }).success,
    ).toBe(true);
  });

  it('limits the job title and rejects unknown roles or fields', () => {
    const base = { email: 'a@b.il', role: 'municipality_admin', departmentId: null };
    expect(inviteStaffSchema.safeParse({ ...base, jobTitle: 'x'.repeat(101) }).success).toBe(false);
    expect(inviteStaffSchema.safeParse({ ...base, role: 'platform_admin' }).success).toBe(false);
    expect(inviteStaffSchema.safeParse({ ...base, municipalityId: dept }).success).toBe(false);
    expect(inviteStaffSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });
});

describe('membership schemas', () => {
  it('validates role and department combinations and the handover', () => {
    expect(
      setEmployeeRoleSchema.safeParse({
        employeeId: emp,
        role: 'employee',
        departmentId: dept,
        reassignTo: other,
      }).success,
    ).toBe(true);
    expect(
      setEmployeeRoleSchema.safeParse({ employeeId: emp, role: 'employee', departmentId: null })
        .success,
    ).toBe(false);
    expect(
      setEmployeeRoleSchema.safeParse({
        employeeId: emp,
        role: 'municipality_admin',
        departmentId: dept,
      }).success,
    ).toBe(false);
    expect(
      setEmployeeRoleSchema.safeParse({
        employeeId: emp,
        role: 'employee',
        departmentId: dept,
        reassignTo: emp,
      }).success,
    ).toBe(false);
  });

  it('validates job title and activation', () => {
    expect(updateEmployeeJobTitleSchema.parse({ employeeId: emp, jobTitle: '  ' })).toEqual({
      employeeId: emp,
      jobTitle: null,
    });
    expect(
      updateEmployeeJobTitleSchema.safeParse({ employeeId: emp, jobTitle: 'x'.repeat(101) })
        .success,
    ).toBe(false);
    expect(setEmployeeActiveSchema.safeParse({ employeeId: emp, isActive: 'yes' }).success).toBe(
      false,
    );
    expect(
      setEmployeeActiveSchema.safeParse({ employeeId: emp, isActive: false, role: 'x' }).success,
    ).toBe(false);
  });
});

describe('staffSignUpSchema', () => {
  it('needs no home municipality and rejects one', async () => {
    const { staffSignUpSchema } = await import('./staff-validation');
    const base = {
      email: 'dana@city.il',
      password: 'long-enough',
      fullName: 'Dana',
      preferredLocale: 'he',
    };
    expect(staffSignUpSchema.safeParse(base).success).toBe(true);
    expect(staffSignUpSchema.safeParse({ ...base, homeMunicipalityId: dept }).success).toBe(true);
    expect(
      'homeMunicipalityId' in staffSignUpSchema.parse({ ...base, homeMunicipalityId: dept }),
    ).toBe(false);
    expect(staffSignUpSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
  });
});
