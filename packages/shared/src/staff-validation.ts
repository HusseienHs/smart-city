import { z } from 'zod';

import { MUNICIPAL_STAFF_ROLES, type MunicipalStaffRole } from './roles';
import { signUpSchema } from './validation';

/*
 * Staff administration: departments, invitations and memberships. These mirror the database
 * checks (supabase/migrations/20261103000200_tenancy.sql and set_employee_role) so forms can show
 * errors early. The database re-validates everything and remains the authority.
 */

/** Roles that must belong to a department (the employees / staff_invitations check). */
export const DEPARTMENT_ROLES = [
  'employee',
  'department_manager',
] as const satisfies readonly MunicipalStaffRole[];

export function roleRequiresDepartment(role: MunicipalStaffRole): boolean {
  return (DEPARTMENT_ROLES as readonly string[]).includes(role);
}

export const JOB_TITLE_MAX_LENGTH = 100;
export const DEPARTMENT_NAME_MAX_LENGTH = 100;

/** Same patterns as the departments table checks. */
export const DEPARTMENT_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const DEPARTMENT_PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

const optionalName = z
  .string()
  .trim()
  .max(DEPARTMENT_NAME_MAX_LENGTH)
  .optional()
  .transform((value) => (value ? value : undefined));

/** Optional contact field: empty or missing → null; otherwise it must match `schema`. */
function blankToNull<S extends z.ZodType<string>>(schema: S) {
  return z
    .preprocess(
      (value) =>
        value === undefined || (typeof value === 'string' && value.trim() === '') ? null : value,
      schema.nullable(),
    )
    .optional()
    .transform((value) => value ?? null);
}

/** A department's name in every language (Hebrew required) and its public contact details. */
export const departmentSchema = z.strictObject({
  name: z.strictObject({
    he: z.string().trim().min(1).max(DEPARTMENT_NAME_MAX_LENGTH),
    ar: optionalName,
    en: optionalName,
  }),
  email: blankToNull(z.string().trim().max(254).regex(DEPARTMENT_EMAIL_PATTERN)),
  phone: blankToNull(z.string().trim().regex(DEPARTMENT_PHONE_PATTERN)),
});
export type DepartmentInput = z.input<typeof departmentSchema>;
export type DepartmentValues = z.output<typeof departmentSchema>;

const jobTitle = z
  .string()
  .trim()
  .max(JOB_TITLE_MAX_LENGTH)
  .nullable()
  .optional()
  .transform((value) => value || null);

/** Department-scoped roles need a department; the other roles never get one. */
function checkRoleDepartment(
  value: { role: MunicipalStaffRole; departmentId: string | null },
  ctx: z.RefinementCtx,
) {
  if (roleRequiresDepartment(value.role) && !value.departmentId) {
    ctx.addIssue({
      code: 'custom',
      path: ['departmentId'],
      message: 'This role requires a department',
    });
  }
  if (!roleRequiresDepartment(value.role) && value.departmentId) {
    ctx.addIssue({
      code: 'custom',
      path: ['departmentId'],
      message: 'This role does not belong to a department',
    });
  }
}

/** An invitation to join a municipality's staff (staff_invitations insert columns). */
export const inviteStaffSchema = z
  .strictObject({
    // The table requires lower-case, trimmed addresses.
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    role: z.enum(MUNICIPAL_STAFF_ROLES),
    departmentId: z.uuid().nullable(),
    jobTitle,
  })
  .superRefine(checkRoleDepartment);
export type InviteStaffInput = z.input<typeof inviteStaffSchema>;

/** Mirrors set_employee_role(p_employee_id, p_role, p_department_id, p_reassign_to). */
export const setEmployeeRoleSchema = z
  .strictObject({
    employeeId: z.uuid(),
    role: z.enum(MUNICIPAL_STAFF_ROLES),
    departmentId: z.uuid().nullable(),
    /** Who takes over the employee's open reports when they leave their department. */
    reassignTo: z.uuid().nullable().optional(),
  })
  .superRefine(checkRoleDepartment)
  .refine((value) => value.reassignTo !== value.employeeId, {
    message: 'Open reports cannot be handed to the same employee',
    path: ['reassignTo'],
  });
export type SetEmployeeRoleInput = z.input<typeof setEmployeeRoleSchema>;

export const updateEmployeeJobTitleSchema = z.strictObject({
  employeeId: z.uuid(),
  jobTitle,
});
export type UpdateEmployeeJobTitleInput = z.input<typeof updateEmployeeJobTitleSchema>;

export const setEmployeeActiveSchema = z.strictObject({
  employeeId: z.uuid(),
  isActive: z.boolean(),
});
export type SetEmployeeActiveInput = z.input<typeof setEmployeeActiveSchema>;

/**
 * Staff account registration in the admin dashboard. The citizen sign-up without a home
 * municipality: creating an account grants nothing — staff access comes only from accepting an
 * invitation addressed to the account's confirmed email.
 */
export const staffSignUpSchema = signUpSchema.omit({ homeMunicipalityId: true });
export type StaffSignUpInput = z.input<typeof staffSignUpSchema>;
