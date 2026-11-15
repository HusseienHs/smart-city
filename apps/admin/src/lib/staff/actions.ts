'use server';

import {
  createDepartment,
  createStaffInvitation,
  isApiError,
  listManagedDepartments,
  listMunicipalityStaff,
  listStaffInvitations,
  revokeStaffInvitation,
  setDepartmentActive,
  setEmployeeActive,
  setEmployeeRole,
  signUpStaff,
  staffAdminIssue,
  toApiError,
  updateDepartment,
  updateEmployeeJobTitle,
  authFieldErrors,
  type ApiError,
  type SmartCityClient,
} from '@smart-city/api';
import {
  DEFAULT_LOCALE,
  departmentSchema,
  inviteStaffSchema,
  isSupportedLocale,
  MUNICIPAL_STAFF_ROLES,
  roleRequiresDepartment,
  setEmployeeRoleSchema,
  staffSignUpSchema,
  JOB_TITLE_MAX_LENGTH,
  type Locale,
  type MunicipalStaffRole,
} from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { ACCESS_PATH, AUTH_CALLBACK_PATH } from '@/lib/auth/routes';
import { siteOrigin } from '@/lib/auth/site-url';
import { getStaffAccess } from '@/lib/auth/staff-context';
import { localizedHref } from '@/lib/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { departmentDeactivationBlocked } from './capabilities';

/*
 * Server Actions for departments, staff and invitations. Each management action authorizes
 * itself on every call:
 *
 * 1. verified session (getClaims) and an ACTIVE membership; the municipality comes from the
 *    database, never from the form;
 * 2. the caller is a municipality admin there (usability check — the database decides);
 * 3. the target department / employee / invitation is looked up IN THAT municipality, as the
 *    caller sees it; anything else is refused the same way;
 * 4. the write runs as the caller's own session through the existing grants, RLS and RPCs.
 *
 * Memberships are never created here; only accept_staff_invitation() does that.
 */

export interface StaffActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Extra result data, e.g. the onboarding link after an invitation. */
  link?: string;
  /**
   * What was typed, echoed back on failure: React resets uncontrolled fields after a form
   * action, so forms use these as default values. Never contains passwords.
   */
  values?: Record<string, string>;
  key?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

const asApiError = (error: unknown): ApiError => (isApiError(error) ? error : toApiError(error));

const fail = (
  message: string,
  fieldErrors?: Record<string, string>,
  values?: Record<string, string>,
): StaffActionState => ({
  status: 'error',
  message,
  fieldErrors,
  values,
  key: Date.now(),
});

const succeed = (message: string, link?: string): StaffActionState => ({
  status: 'success',
  message,
  link,
  key: Date.now(),
});

function errorState(
  t: Translator,
  error: unknown,
  values?: Record<string, string>,
): StaffActionState {
  const apiError = asApiError(error);
  if (apiError.code === 'server' || apiError.code === 'network') {
    console.error('[staff] action failed', apiError.code, apiError.debug);
  }
  const issue = staffAdminIssue(apiError);
  return fail(issue ? t(`adminStaff.issues.${issue}`) : t(apiError.messageKey), undefined, values);
}

interface Admin {
  client: SmartCityClient;
  municipalityId: string;
  /** The caller's own membership id, for self-protection checks. */
  employeeId: string;
}

/** Steps 1 and 2. */
async function actingAdmin(t: Translator): Promise<Admin | StaffActionState> {
  const access = await getStaffAccess();
  if (access.status !== 'staff') return fail(t('apiErrors.unauthorized'));
  if (!access.active || access.active.role !== 'municipality_admin') {
    return fail(t('apiErrors.forbidden'));
  }
  return {
    client: await createSupabaseServerClient(),
    municipalityId: access.active.municipality_id,
    employeeId: access.active.employee_id,
  };
}

const isAdmin = (value: Admin | StaffActionState): value is Admin => 'client' in value;

/** The onboarding link the admin shares with an invited person. */
async function onboardingLink(locale: Locale): Promise<string> {
  return `${await siteOrigin()}${localizedHref(locale, JOIN_PATH_VALUE)}`;
}
const JOIN_PATH_VALUE = '/join';

// ---------------------------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------------------------

function readDepartment(formData: FormData) {
  return {
    name: {
      he: readText(formData, 'nameHe'),
      ar: readText(formData, 'nameAr'),
      en: readText(formData, 'nameEn'),
    },
    email: readText(formData, 'email'),
    phone: readText(formData, 'phone'),
  };
}

function departmentFieldErrors(t: Translator, input: ReturnType<typeof readDepartment>) {
  const parsed = departmentSchema.safeParse(input);
  if (parsed.success) return null;
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const [first, second] = issue.path;
    if (first === 'name') {
      const field = second === 'ar' ? 'nameAr' : second === 'en' ? 'nameEn' : 'nameHe';
      errors[field] =
        issue.code === 'too_big'
          ? t('adminDepartments.form.nameTooLong')
          : t('adminDepartments.form.nameRequired');
    } else if (first === 'email') errors.email = t('adminDepartments.form.emailInvalid');
    else if (first === 'phone') errors.phone = t('adminDepartments.form.phoneInvalid');
  }
  return errors;
}

/** Creates a department (no id) or updates one. Creating opens the new department's page. */
export async function saveDepartmentAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const departmentId = readText(formData, 'departmentId');
  const department = readDepartment(formData);
  const values = {
    nameHe: department.name.he,
    nameAr: department.name.ar,
    nameEn: department.name.en,
    email: department.email,
    phone: department.phone,
  };
  const errors = departmentFieldErrors(t, department);
  if (errors) return fail(Object.values(errors)[0]!, errors, values);

  let createdId: string | null = null;
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return { ...admin, values };
    if (departmentId) {
      if (!UUID.test(departmentId)) return fail(t('apiErrors.forbidden'));
      await updateDepartment(admin.client, {
        municipalityId: admin.municipalityId,
        departmentId,
        department,
      });
    } else {
      createdId = (
        await createDepartment(admin.client, { municipalityId: admin.municipalityId, department })
      ).id;
    }
  } catch (error) {
    return errorState(t, error, values);
  }
  if (createdId) redirect(localizedHref(locale, `/departments/${createdId}`));
  refresh();
  return succeed(t('adminStaff.saved'));
}

/** Activates or deactivates. Deactivation is refused while active staff belong to it. */
export async function setDepartmentActiveAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const t = createTranslator(readLocale(formData));
  const departmentId = readText(formData, 'departmentId');
  const isActive = readText(formData, 'active') === 'true';
  if (!UUID.test(departmentId)) return fail(t('apiErrors.forbidden'));
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return admin;
    const departments = await listManagedDepartments(admin.client, {
      municipalityId: admin.municipalityId,
    });
    if (!departments.some((d) => d.id === departmentId)) return fail(t('apiErrors.forbidden'));
    if (!isActive) {
      const staff = await listMunicipalityStaff(admin.client, {
        municipalityId: admin.municipalityId,
      });
      const members = staff.filter((m) => m.is_active && m.department_id === departmentId).length;
      if (departmentDeactivationBlocked(members)) {
        return fail(t('adminDepartments.activation.blocked', { count: members }));
      }
    }
    await setDepartmentActive(admin.client, {
      municipalityId: admin.municipalityId,
      departmentId,
      isActive,
    });
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(
    isActive
      ? t('adminDepartments.activation.activated')
      : t('adminDepartments.activation.deactivated'),
  );
}

// ---------------------------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------------------------

/** An active department of the caller's municipality, when the role needs one. */
async function checkInvitationDepartment(
  admin: Admin,
  role: MunicipalStaffRole,
  departmentId: string | null,
): Promise<boolean> {
  if (!roleRequiresDepartment(role)) return departmentId === null;
  if (!departmentId) return false;
  const departments = await listManagedDepartments(admin.client, {
    municipalityId: admin.municipalityId,
  });
  return departments.some((d) => d.id === departmentId && d.isActive);
}

export async function inviteStaffAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const role = readText(formData, 'role');
  const invitation = {
    email: readText(formData, 'email'),
    role: role as MunicipalStaffRole,
    departmentId:
      (MUNICIPAL_STAFF_ROLES as readonly string[]).includes(role) &&
      roleRequiresDepartment(role as MunicipalStaffRole)
        ? readText(formData, 'departmentId') || null
        : null,
    jobTitle: readText(formData, 'jobTitle'),
  };
  const values = {
    email: invitation.email,
    role,
    departmentId: invitation.departmentId ?? '',
    jobTitle: invitation.jobTitle,
  };
  const parsed = inviteStaffSchema.safeParse(invitation);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (field === 'email') errors.email = t('adminInvitations.emailInvalid');
      else if (field === 'departmentId')
        errors.departmentId = t('adminInvitations.departmentRequired');
      else if (field === 'jobTitle') errors.jobTitle = t('adminEmployees.detail.jobTitleTooLong');
      else errors.role = t('apiErrors.validation');
    }
    return fail(Object.values(errors)[0]!, errors, values);
  }

  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return { ...admin, values };
    if (!(await checkInvitationDepartment(admin, parsed.data.role, parsed.data.departmentId))) {
      const message = t('adminInvitations.departmentRequired');
      return fail(message, { departmentId: message }, values);
    }
    const created = await createStaffInvitation(admin.client, {
      municipalityId: admin.municipalityId,
      invitation: parsed.data,
    });
    refresh();
    return succeed(
      t('adminInvitations.created', { email: created.email }),
      await onboardingLink(locale),
    );
  } catch (error) {
    return errorState(t, error, values);
  }
}

/** Finds an invitation of the caller's municipality (RLS: admins only). */
async function findInvitation(admin: Admin, invitationId: string) {
  if (!UUID.test(invitationId)) return null;
  const invitations = await listStaffInvitations(admin.client, {
    municipalityId: admin.municipalityId,
  });
  return invitations.find((invitation) => invitation.id === invitationId) ?? null;
}

export async function revokeInvitationAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const t = createTranslator(readLocale(formData));
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return admin;
    const invitation = await findInvitation(admin, readText(formData, 'invitationId'));
    if (!invitation) return fail(t('adminStaff.issues.invitation_unavailable'));
    await revokeStaffInvitation(admin.client, { invitationId: invitation.id });
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(t('adminInvitations.revoked'));
}

/**
 * Invites the same address again with the same role and department. An expired invitation is
 * still `pending` in the database and blocks a new one, so it is revoked first.
 */
export async function reinviteAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return admin;
    const invitation = await findInvitation(admin, readText(formData, 'invitationId'));
    if (!invitation || !['expired', 'revoked', 'declined'].includes(invitation.state)) {
      return fail(t('adminStaff.issues.invitation_unavailable'));
    }
    const role = invitation.role as MunicipalStaffRole;
    if (!(await checkInvitationDepartment(admin, role, invitation.department_id))) {
      return fail(t('adminStaff.issues.invited_department_inactive'));
    }
    if (invitation.state === 'expired') {
      await revokeStaffInvitation(admin.client, { invitationId: invitation.id });
    }
    await createStaffInvitation(admin.client, {
      municipalityId: admin.municipalityId,
      invitation: {
        email: invitation.email,
        role,
        departmentId: invitation.department_id,
        jobTitle: invitation.job_title,
      },
    });
    refresh();
    return succeed(
      t('adminInvitations.reinvited', { email: invitation.email }),
      await onboardingLink(locale),
    );
  } catch (error) {
    refresh();
    return errorState(t, error);
  }
}

// ---------------------------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------------------------

/** The target membership in the caller's municipality, and not the caller's own. */
async function findMember(admin: Admin, t: Translator, employeeId: string) {
  if (!UUID.test(employeeId)) return { error: fail(t('apiErrors.forbidden')) };
  if (employeeId === admin.employeeId) return { error: fail(t('adminStaff.issues.self_change')) };
  const staff = await listMunicipalityStaff(admin.client, { municipalityId: admin.municipalityId });
  const member = staff.find((m) => m.employee_id === employeeId);
  return member ? { member } : { error: fail(t('apiErrors.forbidden')) };
}

export async function updateJobTitleAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const t = createTranslator(readLocale(formData));
  const jobTitle = readText(formData, 'jobTitle').trim();
  const values = { jobTitle };
  if (jobTitle.length > JOB_TITLE_MAX_LENGTH) {
    const message = t('adminEmployees.detail.jobTitleTooLong');
    return fail(message, { jobTitle: message }, values);
  }
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return admin;
    const found = await findMember(admin, t, readText(formData, 'employeeId'));
    if (found.error) return found.error;
    await updateEmployeeJobTitle(admin.client, {
      municipalityId: admin.municipalityId,
      employeeId: found.member.employee_id,
      jobTitle,
    });
  } catch (error) {
    return errorState(t, error, values);
  }
  refresh();
  return succeed(t('adminStaff.saved'));
}

export async function setEmployeeRoleAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const t = createTranslator(readLocale(formData));
  const role = readText(formData, 'role') as MunicipalStaffRole;
  const departmentValue = readText(formData, 'departmentId');
  const reassignValue = readText(formData, 'reassignTo');
  const input = {
    employeeId: readText(formData, 'employeeId'),
    role,
    departmentId:
      (MUNICIPAL_STAFF_ROLES as readonly string[]).includes(role) && roleRequiresDepartment(role)
        ? departmentValue || null
        : null,
    reassignTo: reassignValue || null,
  };
  const parsed = setEmployeeRoleSchema.safeParse(input);
  if (!parsed.success) {
    const departmentIssue = parsed.error.issues.some((issue) => issue.path[0] === 'departmentId');
    const message = departmentIssue
      ? t('adminStaff.issues.department_required')
      : t('apiErrors.validation');
    return fail(message, departmentIssue ? { departmentId: message } : undefined);
  }

  let moved = 0;
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return admin;
    const found = await findMember(admin, t, parsed.data.employeeId);
    if (found.error) return found.error;
    if (!found.member.is_active) return fail(t('adminEmployees.role.inactiveNotice'));
    if (
      found.member.role === parsed.data.role &&
      found.member.department_id === parsed.data.departmentId
    ) {
      return fail(t('adminEmployees.role.unchanged'));
    }
    moved = await setEmployeeRole(admin.client, parsed.data);
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(t('adminEmployees.role.done', { count: moved }));
}

export async function setEmployeeActiveAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const t = createTranslator(readLocale(formData));
  const isActive = readText(formData, 'active') === 'true';
  try {
    const admin = await actingAdmin(t);
    if (!isAdmin(admin)) return admin;
    const found = await findMember(admin, t, readText(formData, 'employeeId'));
    if (found.error) return found.error;
    await setEmployeeActive(admin.client, {
      municipalityId: admin.municipalityId,
      employeeId: found.member.employee_id,
      isActive,
    });
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(
    isActive
      ? t('adminEmployees.activation.activated')
      : t('adminEmployees.activation.deactivated'),
  );
}

// ---------------------------------------------------------------------------------------------
// Staff registration (public)
// ---------------------------------------------------------------------------------------------

/**
 * Creates an account for an invited person. Grants nothing by itself: the account sees and
 * accepts only invitations addressed to its CONFIRMED email, on the access page. The
 * confirmation link returns through the PKCE callback to that page.
 */
export async function staffSignUpAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const input = {
    email: readText(formData, 'email').trim(),
    password: readText(formData, 'password'),
    fullName: readText(formData, 'fullName').trim(),
    preferredLocale: locale,
  };
  const values = { email: input.email, fullName: input.fullName };
  const errors: Record<string, string> = {};
  if (input.password !== readText(formData, 'confirm'))
    errors.confirm = t('auth.errors.passwordsDontMatch');
  const parsed = staffSignUpSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (field === 'email') errors.email = t('auth.errors.invalidEmail');
      else if (field === 'password') errors.password = t('auth.errors.passwordTooShort');
      else if (field === 'fullName') errors.fullName = t('adminJoin.nameRequired');
    }
  }
  if (Object.keys(errors).length > 0) return fail(Object.values(errors)[0]!, errors, values);

  const next = localizedHref(locale, ACCESS_PATH);
  const callback = `${await siteOrigin()}${localizedHref(locale, AUTH_CALLBACK_PATH)}?next=${encodeURIComponent(next)}`;
  try {
    await signUpStaff(await createSupabaseServerClient(), input, callback);
  } catch (error) {
    const apiError = asApiError(error);
    const fields = authFieldErrors(apiError);
    const fieldErrors: Record<string, string> = {};
    if (fields.email) fieldErrors.email = t(fields.email);
    if (fields.password) fieldErrors.password = t(fields.password);
    return Object.keys(fieldErrors).length > 0
      ? fail(Object.values(fieldErrors)[0]!, fieldErrors, values)
      : fail(t(apiError.messageKey), undefined, values);
  }
  return succeed(t('adminJoin.sentDescription', { email: input.email }));
}
