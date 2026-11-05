import {
  emailOnlySchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
  type EmailOnlyInput,
  type SignInInput,
  type SignUpInput,
  type UpdatePasswordInput,
} from '@smart-city/shared';

import type { SmartCityClient } from '../client';
import { toApiError } from '../errors/to-api-error';
import { parseInput } from '../utils/validation';
import { fromAuthError, type SupabaseAuthErrorLike } from './auth-errors';

/*
 * Account actions for citizens. Always the publishable-key client: nothing here needs a
 * privileged key. Passwords are only passed through to Supabase, never stored or logged.
 *
 * Session changes are observed through `client.auth.onAuthStateChange` in the app.
 */

async function runAuth<R extends { error: SupabaseAuthErrorLike | null }>(
  request: PromiseLike<R>,
): Promise<R> {
  let response: R;
  try {
    response = await request;
  } catch (error) {
    throw toApiError(error);
  }
  if (response.error) throw fromAuthError(response.error);
  return response;
}

export interface SignUpResult {
  /** False only when the project auto-confirms emails, in which case the user is signed in. */
  needsEmailVerification: boolean;
}

/**
 * Registers a citizen. `private.handle_new_user()` creates the profile from the `full_name` and
 * `preferred_locale` metadata, so those exact names matter.
 *
 * While email confirmation is on, signing up with a registered email also "succeeds" (no session,
 * no new account), so this response doesn't reveal whether an account exists.
 */
export async function signUp(
  client: SmartCityClient,
  input: SignUpInput,
  emailRedirectTo: string,
): Promise<SignUpResult> {
  const { email, password, fullName, preferredLocale } = parseInput(signUpSchema, input);
  const { data } = await runAuth(
    client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { full_name: fullName, preferred_locale: preferredLocale },
      },
    }),
  );
  return { needsEmailVerification: !data.session };
}

export async function signIn(client: SmartCityClient, input: SignInInput): Promise<void> {
  const credentials = parseInput(signInSchema, input);
  await runAuth(client.auth.signInWithPassword(credentials));
}

/** Ends this device's session, on the server too. Other devices stay signed in. */
export async function signOut(client: SmartCityClient): Promise<void> {
  await runAuth(client.auth.signOut({ scope: 'local' }));
}

export async function resendVerificationEmail(
  client: SmartCityClient,
  input: EmailOnlyInput,
  emailRedirectTo: string,
): Promise<void> {
  const { email } = parseInput(emailOnlySchema, input);
  await runAuth(client.auth.resend({ type: 'signup', email, options: { emailRedirectTo } }));
}

export async function requestPasswordReset(
  client: SmartCityClient,
  input: EmailOnlyInput,
  redirectTo: string,
): Promise<void> {
  const { email } = parseInput(emailOnlySchema, input);
  await runAuth(client.auth.resetPasswordForEmail(email, { redirectTo }));
}

/** Changes the signed-in user's password, including during password recovery. */
export async function updatePassword(
  client: SmartCityClient,
  input: UpdatePasswordInput,
): Promise<void> {
  const { password } = parseInput(updatePasswordSchema, input);
  await runAuth(client.auth.updateUser({ password }));
}

/**
 * Completes a PKCE email link. The code only works together with the verifier stored on the device
 * that requested the email, so a code from someone else's link can't sign anyone in.
 */
export async function exchangeAuthCode(client: SmartCityClient, code: string): Promise<void> {
  await runAuth(client.auth.exchangeCodeForSession(code));
}
