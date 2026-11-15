import { staffSignUpSchema, type StaffSignUpInput } from '@smart-city/shared';

import type { SmartCityClient } from '../client';
import { toApiError } from '../errors/to-api-error';
import { parseInput } from '../utils/validation';
import { fromAuthError } from './auth-errors';
import type { SignUpResult } from './auth';

/**
 * Creates an account for someone invited to a municipality's staff (admin dashboard).
 *
 * Only `full_name` and `preferred_locale` are sent as metadata — never a home municipality:
 * private.handle_new_user() then creates a profile with no home city. The account grants no
 * staff access by itself. Access comes only from accept_staff_invitation(), which requires the
 * account's email to be CONFIRMED and to match a pending, unexpired invitation.
 *
 * While email confirmation is on, signing up with a registered address also "succeeds" (no
 * session, no new account), so the response doesn't reveal whether an account exists.
 */
export async function signUpStaff(
  client: SmartCityClient,
  input: StaffSignUpInput,
  emailRedirectTo: string,
): Promise<SignUpResult> {
  const { email, password, fullName, preferredLocale } = parseInput(staffSignUpSchema, input);
  let response: Awaited<ReturnType<SmartCityClient['auth']['signUp']>>;
  try {
    response = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { full_name: fullName, preferred_locale: preferredLocale },
      },
    });
  } catch (error) {
    throw toApiError(error);
  }
  if (response.error) throw fromAuthError(response.error);
  return { needsEmailVerification: !response.data.session };
}
