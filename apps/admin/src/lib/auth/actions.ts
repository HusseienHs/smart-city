'use server';

import {
  acceptStaffInvitation,
  authFieldErrors,
  declineStaffInvitation,
  getMyStaffMemberships,
  isApiError,
  requestPasswordReset,
  signIn,
  signOut,
  toApiError,
  updatePassword,
  type ApiError,
} from '@smart-city/api';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { localizedHref } from '@/lib/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  ACTIVE_MUNICIPALITY_COOKIE,
  ACTIVE_MUNICIPALITY_MAX_AGE_SECONDS,
} from './active-municipality';
import {
  ACCESS_PATH,
  AUTH_CALLBACK_PATH,
  RESET_PASSWORD_PATH,
  safeNextPath,
  signInHref,
} from './routes';
import { siteOrigin } from './site-url';

/*
 * Server Actions for authentication and staff access. Each one authorizes itself: it acts as
 * the caller's own session (publishable key + session cookies), never with a privileged key,
 * and the database decides what is allowed. Inputs from the form are validated here and again
 * by the API layer. Passwords are passed straight to Supabase and never logged or returned.
 */

export type AuthField = 'email' | 'password' | 'confirm';

export interface AuthFormState {
  status: 'idle' | 'error' | 'sent';
  /** A message for the whole form, already localized. */
  message?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  /** Echoed back so the form keeps what was typed (never the password). */
  email?: string;
}

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** A localized form error from an API failure. */
function errorState(
  t: Translator,
  error: ApiError,
  email: string | undefined,
  overrides: Parameters<typeof authFieldErrors>[1] = {},
): AuthFormState {
  const fields = authFieldErrors(error, overrides);
  const fieldErrors: AuthFormState['fieldErrors'] = {};
  if (fields.email) fieldErrors.email = t(fields.email);
  if (fields.password) fieldErrors.password = t(fields.password);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return {
    status: 'error',
    message: hasFieldErrors ? undefined : t(error.messageKey),
    fieldErrors,
    email,
  };
}

const asApiError = (error: unknown): ApiError => (isApiError(error) ? error : toApiError(error));

// ---------------------------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------------------------

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const email = readText(formData, 'email').trim();
  const password = readText(formData, 'password');

  try {
    await signIn(await createSupabaseServerClient(), { email, password });
  } catch (error) {
    return errorState(t, asApiError(error), email, { password: 'auth.errors.passwordRequired' });
  }
  // Where to go is checked server-side: only same-site dashboard paths are allowed.
  redirect(safeNextPath(readText(formData, 'next'), locale));
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  try {
    await signOut(await createSupabaseServerClient());
  } catch {
    // The local session cookies are cleared even when the server can't be reached.
  }
  (await cookies()).delete(ACTIVE_MUNICIPALITY_COOKIE);
  redirect(signInHref(locale, undefined, 'signed-out'));
}

// ---------------------------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------------------------

/**
 * Sends a reset link. The answer is the same whether or not the address has an account, so the
 * form can't be used to find out who has one. The link is a PKCE link: it only works in this
 * browser, which holds the verifier cookie.
 */
export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const email = readText(formData, 'email').trim();

  const next = localizedHref(locale, RESET_PASSWORD_PATH);
  const callback = `${await siteOrigin()}${localizedHref(locale, AUTH_CALLBACK_PATH)}?next=${encodeURIComponent(next)}`;
  try {
    await requestPasswordReset(await createSupabaseServerClient(), { email }, callback);
  } catch (error) {
    return errorState(t, asApiError(error), email);
  }
  return { status: 'sent', email };
}

/** Sets a new password for the signed-in (recovery) session, then opens the dashboard. */
export async function updatePasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const password = readText(formData, 'password');
  const confirm = readText(formData, 'confirm');

  if (password !== confirm) {
    return {
      status: 'error',
      fieldErrors: { confirm: t('auth.errors.passwordsDontMatch') },
    };
  }
  try {
    await updatePassword(await createSupabaseServerClient(), { password });
  } catch (error) {
    const apiError = asApiError(error);
    if (apiError.code === 'unauthorized') {
      return { status: 'error', message: t('adminAuth.resetLinkMissingDescription') };
    }
    return errorState(t, apiError, undefined);
  }
  redirect(localizedHref(locale, '/'));
}

// ---------------------------------------------------------------------------------------------
// Municipality and invitations
// ---------------------------------------------------------------------------------------------

async function rememberMunicipality(municipalityId: string): Promise<void> {
  (await cookies()).set(ACTIVE_MUNICIPALITY_COOKIE, municipalityId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACTIVE_MUNICIPALITY_MAX_AGE_SECONDS,
  });
}

/**
 * Switches the active municipality. Only a municipality where the caller has an active
 * membership right now is accepted; anything else is ignored.
 */
export async function selectMunicipalityAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const municipalityId = readText(formData, 'municipalityId');
  const memberships = await getMyStaffMemberships(await createSupabaseServerClient()).catch(
    () => [],
  );
  if (memberships.some((membership) => membership.municipality_id === municipalityId)) {
    await rememberMunicipality(municipalityId);
  }
  // The new municipality may give a different role: start from its overview.
  redirect(localizedHref(locale, '/'));
}

export type InvitationNotice = 'accepted' | 'declined' | 'unavailable' | 'error';

function accessHref(locale: Locale, notice: InvitationNotice, municipalityId?: string) {
  const params = new URLSearchParams({ notice });
  if (municipalityId) params.set('municipality', municipalityId);
  return `${localizedHref(locale, ACCESS_PATH)}?${params}`;
}

/** Accepts an invitation addressed to the caller, then works in that municipality. */
export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const invitationId = readText(formData, 'invitationId');
  const municipalityId = readText(formData, 'municipalityId');
  const client = await createSupabaseServerClient();
  let notice: InvitationNotice = 'accepted';
  try {
    await acceptStaffInvitation(client, { invitationId });
    // Verified against the database, not taken from the form.
    const memberships = await getMyStaffMemberships(client);
    if (memberships.some((membership) => membership.municipality_id === municipalityId)) {
      await rememberMunicipality(municipalityId);
    }
  } catch (error) {
    const apiError = asApiError(error);
    if (apiError.code === 'unauthorized') redirect(signInHref(locale, undefined, 'session'));
    notice =
      apiError.code === 'forbidden' || apiError.code === 'validation' ? 'unavailable' : 'error';
  }
  redirect(accessHref(locale, notice, notice === 'accepted' ? municipalityId : undefined));
}

export async function declineInvitationAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const invitationId = readText(formData, 'invitationId');
  let notice: InvitationNotice = 'declined';
  try {
    await declineStaffInvitation(await createSupabaseServerClient(), { invitationId });
  } catch (error) {
    const apiError = asApiError(error);
    if (apiError.code === 'unauthorized') redirect(signInHref(locale, undefined, 'session'));
    notice =
      apiError.code === 'forbidden' || apiError.code === 'validation' ? 'unavailable' : 'error';
  }
  redirect(accessHref(locale, notice));
}
