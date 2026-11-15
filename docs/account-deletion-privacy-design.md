# Design: Account deletion, Privacy Policy and Terms of Use (Citizen Mobile App)

**Status:** proposal, waiting for owner approval. Nothing has been implemented, no migration has been written, and nothing
has been run against `smart-city-dev`.
**Date:** 2026-11-09
**Scope:** `apps/mobile`, `packages/api`, `packages/shared`, `supabase/`. `apps/admin` is out of scope (Athel), but §4.6
lists what the admin dashboard will see after a citizen deletes their account.

> Environment constraint (D-007): `smart-city-dev` holds synthetic data only. This design must be in place, and the legal
> text reviewed by counsel, **before** real citizen data is stored. The retention rules in §5 are engineering
> recommendations, not legal advice. They need sign-off under the Israeli Privacy Protection Law (including Amendment 13)
> and the municipal contracts.

---

## 1. Current implementation findings

### 1.1 Profile and account screens

| Item                                                               | State                                                                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [profile.tsx](<../apps/mobile/src/app/(tabs)/profile.tsx>)         | Sections: My reports and home area, **Account settings** (personal details, language, dark mode, notifications), **General** (sign out). No privacy, legal or delete entries. |
| [account/\_layout.tsx](../apps/mobile/src/app/account/_layout.tsx) | Stack with `details`, `language` and `notifications`.                                                                                                                         |
| [account/details.tsx](../apps/mobile/src/app/account/details.tsx)  | Edits full name, phone (`profile_contacts`), home municipality and neighborhood. The phone can already be removed (`deleteMyPhone`).                                          |
| Account deletion / deactivation                                    | **Not implemented** anywhere: not in mobile, `packages/api`, SQL or Edge Functions. `supabase/functions/` doesn't exist.                                                      |

### 1.2 Authentication

- Supabase Auth, email + password, PKCE, with the session kept in AsyncStorage
  ([supabase.ts](../apps/mobile/src/lib/supabase.ts), D-006). The client uses only the **publishable key**. No
  service-role key is used anywhere in `apps/mobile` or `packages/api` ✅.
- [auth.tsx](../apps/mobile/src/lib/auth.tsx) exposes `signIn`, `signUp`, `signOut` (server-side first, then local),
  password recovery and a dev-only preview mode. A `hasSignedOut` flag sends a user who signed out to sign-in rather
  than sign-up.
- [\_layout.tsx](../apps/mobile/src/app/_layout.tsx) guards routes with `Stack.Protected`. Only `auth/callback` is
  reachable in every auth state.
- `private.handle_new_user()` (latest version in `20261108000100_israeli_cities.sql`) creates the `profiles` row from
  whitelisted metadata: `full_name`, `preferred_locale` and `home_municipality_id`.

### 1.3 Personal data inventory (database)

FK behavior when the `auth.users` row is deleted (`profiles.id → auth.users ON DELETE CASCADE`):

| Table / store                                         | Personal data                                                                                              | FK on user deletion         | Effect today if the auth user is deleted                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `auth.users` (+ identities, sessions, refresh tokens) | email, password hash, `raw_user_meta_data` (name, locale, home city)                                       | —                           | Deleted by the Auth admin API                                                                                                     |
| `profiles`                                            | full name, locale, home municipality/neighborhood                                                          | `CASCADE` from `auth.users` | Deleted                                                                                                                           |
| `profile_contacts`                                    | phone                                                                                                      | `CASCADE`                   | Deleted                                                                                                                           |
| `notifications`                                       | report ids and tracking numbers addressed to the user                                                      | `CASCADE`                   | Deleted                                                                                                                           |
| `push_tokens`                                         | device push token                                                                                          | `CASCADE`                   | Deleted                                                                                                                           |
| `report_confirmations`, `report_followers`            | which reports the user confirmed or follows                                                                | `CASCADE`                   | Deleted, but `reports.confirmation_count` / `follower_count` **aren't decremented** (§4.2)                                        |
| `reports`                                             | description (free text), exact location, address, `reporter_id`                                            | `reporter_id SET NULL`      | Report kept, link to the person removed                                                                                           |
| `report_attachments`                                  | citizen photos (EXIF stripped on device), `uploaded_by`                                                    | `uploaded_by SET NULL`      | Kept, de-linked                                                                                                                   |
| `report_comments`                                     | free-text comments, `author_id`                                                                            | `author_id SET NULL`        | Kept, de-linked; `from_reporter = true` is kept                                                                                   |
| `report_status_history`                               | `changed_by` (the reporter for the initial row)                                                            | `SET NULL`                  | Kept, de-linked                                                                                                                   |
| `employees`, `platform_admins`                        | staff membership                                                                                           | `CASCADE`                   | **Deleted silently.** The staff member's assignments are released by FK, but the `employees` audit trigger doesn't fire on DELETE |
| `staff_invitations`                                   | invitee email; `invited_by` / `accepted_user_id`                                                           | `SET NULL`                  | Kept                                                                                                                              |
| `announcements`                                       | `created_by` / `published_by`                                                                              | `SET NULL`                  | Kept                                                                                                                              |
| `audit_logs`                                          | `actor_id` (no FK, by design), `details` jsonb                                                             | none                        | Kept. Append-only: triggers block UPDATE/DELETE/TRUNCATE                                                                          |
| `storage.objects` (`report-media`)                    | photo files; `owner_id` = uploader                                                                         | managed by Supabase Storage | Path has no user id ✅. Whether `owner_id` blocks `deleteUser` **needs verification** (§8, R-4)                                   |
| Device (AsyncStorage / cache)                         | session, `smart-city.report-draft.v*.{userId}`, `smart-city.auth.password-recovery`, pending camera photos | —                           | Not cleaned up by sign-out today                                                                                                  |

### 1.4 RLS and access paths after deletion

- Every citizen read path (`get_my_reports`, `get_my_report_updates`, `get_my_report_comments`,
  `get_my_report_attachments`, `can_read_report_media`) matches on `reporter_id = auth.uid()`. Once `reporter_id` is
  null, nobody can reach those reports as "the reporter" ✅.
- `get_report_reporter_contact()` returns no row when `reporter_id` is null ✅. Staff still see the report, photos and
  comments, as intended for municipal records.
- `get_public_reports()` never exposes the reporter ✅.
- `get_audit_log()` already hides citizen `actor_id` from everyone ✅. The raw UUID stays in `audit_logs`, but after
  deletion it no longer resolves to a person (it becomes a pseudonym).

### 1.5 Privacy Policy

| Required item                             | State                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy screen                     | ❌ Missing                                                                                                                                                                                                          |
| Privacy policy link (app, sign-up, store) | ❌ Missing                                                                                                                                                                                                          |
| Explanation of personal data collection   | ❌ Missing. Only two inline notices: `reportFlow.locationPrivacy` and `reportFlow.photoPrivacy`                                                                                                                     |
| Location permission explanation           | ✅ iOS purpose strings in `app.json` and `locales/{he,ar,en}.json` (when-in-use and precise location only; "always" is disabled). In-app notice on the location step, with a link to Settings when access is denied |
| Camera / photo permission explanation     | ✅ iOS purpose strings in all three languages; microphone disabled. In-app `photoPrivacy` notice. Android has no rationale text (Android doesn't require one)                                                       |
| Data sharing (municipality, processors)   | ❌ Missing                                                                                                                                                                                                          |
| Retention information                     | ❌ Missing, and no retention rules exist yet (database-design §8 item 8)                                                                                                                                            |
| Contact for privacy requests              | ❌ Missing                                                                                                                                                                                                          |

### 1.6 Terms of Use

All missing: no screen, link, user responsibilities, reporting rules or acceptable-use text. Sign-up
([sign-up.tsx](../apps/mobile/src/app/sign-up.tsx)) has no consent notice or acceptance record.

The server already enforces some rules that the terms should state: 10 reports per user per hour, a 5-photo cap,
`spam_or_abuse` as a rejection reason, and reporting only to `active` municipalities.

### 1.7 Localization

- Messages live in `packages/shared/src/i18n/messages/{en,he,ar}.ts`. The `Messages` type is derived from `en`, so
  `he` and `ar` fail to compile if a key is missing. `translate()` falls back to he → en → key.
- Direction comes from `useI18n().direction`, applied at the root `View` and through `LocaleProvider`.
- **No keys exist** for account deletion, privacy policy, terms of use, consent, deletion confirmation dialogs or
  deletion success and error messages.
- Stale key: `profile.demoNotice` ("DEMO: phone and home area are kept on this screen only…") no longer matches the
  app. It should be removed when the profile namespace is next changed.

---

## 2. Missing functionality (summary)

1. Server-side, privileged account deletion (none exists).
2. Pre-deletion cleanup: block staff accounts, decrement confirmation and follower counts, release the storage owner
   (§4.2).
3. Re-authentication before deletion.
4. Mobile screens: Delete account, Privacy policy, Terms of use; a "Privacy & legal" section in Profile; a consent
   notice at sign-up.
5. Local device cleanup after deletion (draft, recovery flag, session).
6. Legal text in three languages, with versioning and a hosted web copy (needed for store listings, and Google Play
   requires a web URL for deletion requests).
7. A defined retention policy for reports, comments, photos and audit entries.
8. Translations (§7).

---

## 3. Recommended account deletion architecture

### 3.1 Choice

| Option                                                                                                                                                                                                    | Verdict                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Supabase Edge Function `delete-account`** that verifies the caller's JWT, runs a DB prepare function, then calls `auth.admin.deleteUser()` with the service role held only in the function's secrets | **Recommended.** Uses the supported Auth Admin API, so sessions, identities and refresh tokens are cleaned up by GoTrue. The service role never leaves the server, and freshness of the login is easy to enforce.                 |
| B. `security definer` SQL RPC that runs `delete from auth.users where id = auth.uid()`                                                                                                                    | Works without new infrastructure, but writes directly to the `auth` schema (not a supported contract), skips the Storage owner checks and any GoTrue hooks, and lets any stolen access token delete the account. Not recommended. |
| C. Soft delete (`profiles.deleted_at`) plus a scheduled hard delete                                                                                                                                       | Adds a grace period and an undo, but needs a scheduler (pg_cron or a scheduled function) and every RLS path must handle "pending deletion". Possible later; not needed for store compliance.                                      |

### 3.2 Flow (Option A)

```text
Mobile: Profile → Delete account screen
  1. Show what will be deleted and what will be kept (§5); the user re-enters their password
  2. supabase.auth.signInWithPassword(email, password)   → fresh session (re-authentication)
  3. Native confirm dialog ("Delete permanently?")
  4. supabase.functions.invoke('delete-account')          → Authorization: Bearer <fresh JWT>

Edge Function delete-account (verify_jwt = true, POST only)
  5. auth.getUser(jwt) with the anon client               → user id; reject if invalid
  6. Require a recent password login: JWT `amr` contains a password entry less than 5 minutes old,
     otherwise 401 { code: 'reauth_required' }
  7. service client: rpc('prepare_account_deletion', { p_user_id })
        - raises 'staff_account' / 'platform_admin' if the user has any employees / platform_admins row
        - decrements counts, deletes confirmations and follows, deletes push tokens
        - releases storage ownership of the user's report-media objects (if required, see R-4)
        - writes audit 'account.deleted' (actor_kind 'system', no personal data)
  8. service client: auth.admin.deleteUser(user_id)       → hard delete; FK cascades in §1.3 run
  9. 200 { ok: true }

Mobile
 10. signOut({ scope: 'local' }); remove the draft and recovery keys; ReportDraftProvider gets owner=null
 11. Go to sign-up with a one-time "Your account was deleted" notice
```

Step 7 is idempotent and changes no rows that belong to anyone else, so a failure at step 8 is safe to retry: the
user is still signed in and can try again.

### 3.3 Why staff accounts are blocked

Deleting a staff member's auth user would cascade-delete their `employees` membership without the audit trigger
firing (it only covers INSERT and UPDATE) and would release their report assignments. A municipality admin must
deactivate the membership first (an existing, audited flow). After that, the citizen side of the account can be
deleted. The mobile app shows a translated message telling the user to contact their municipality admin.

---

## 4. Required database or backend changes (approval required)

All changes are **fix-forward**: migrations 0001–0008 are applied and must not be edited.

### 4.1 New migration `supabase/migrations/2026111X000100_account_deletion.sql`

```sql
-- Sketch only — final SQL to be written after approval.
create function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.employees e where e.user_id = p_user_id) then
    raise exception 'Staff accounts must be offboarded first'
      using errcode = 'P0001', hint = 'staff_account';
  end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then
    raise exception 'Platform admin accounts cannot be self-deleted'
      using errcode = 'P0001', hint = 'platform_admin';
  end if;

  -- Keep the public counters consistent (a cascade delete wouldn't decrement them).
  update public.reports r set confirmation_count = greatest(r.confirmation_count - 1, 0)
  from public.report_confirmations c where c.report_id = r.id and c.user_id = p_user_id;
  delete from public.report_confirmations where user_id = p_user_id;

  update public.reports r set follower_count = greatest(r.follower_count - 1, 0)
  from public.report_followers f where f.report_id = r.id and f.user_id = p_user_id;
  delete from public.report_followers where user_id = p_user_id;

  -- Only if R-4 is confirmed on the dev project:
  -- update storage.objects set owner = null, owner_id = null
  --   where bucket_id = 'report-media' and owner_id = p_user_id::text;

  perform private.write_audit(null, 'account.deleted', 'account', null, '{}'::jsonb, 'system');
end;
$$;

revoke execute on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
```

Notes:

- It goes in `public` only because PostgREST, and therefore `supabase-js` `rpc()` from the Edge Function, can call
  only exposed schemas. It is **not** executable by `anon` or `authenticated`. `schema-guards.test.ts` must be updated
  so the "exactly the intended RPCs to authenticated" check still passes and a new assertion covers service-role-only
  functions.
- `confirmation_count` / `follower_count` are workflow-critical columns that API roles can't write. This function is
  the only new writer.
- Optional, depending on decision D-4 (§10): add `profiles.terms_version` and `profiles.terms_accepted_at`, written by
  `handle_new_user()` from sign-up metadata. Default is **not** to add them yet.

### 4.2 New Edge Function `supabase/functions/delete-account/index.ts`

- Deno, `@supabase/supabase-js` v2, `verify_jwt = true`, POST only, CORS limited to what Expo needs (native requests
  don't send CORS; web dev does).
- Secrets: `SUPABASE_SERVICE_ROLE_KEY` comes from the platform's built-in function environment. **Never** committed,
  never in `.env.example`, never prefixed `EXPO_PUBLIC_`.
- Responses: `{ ok: true }` or `{ ok: false, code: 'reauth_required' | 'staff_account' | 'platform_admin' | 'unknown' }`.
  No stack traces and no user ids in responses or logs.
- Deployment needs the owner's go-ahead: `supabase functions deploy delete-account` against `smart-city-dev`.

### 4.3 `packages/api`

- New `src/me/account.ts`: `deleteMyAccount(client)` wraps `client.functions.invoke('delete-account')` and maps the
  codes to `ApiError` kinds. Exported from `src/index.ts`.
- Regenerate `database.types.ts` after the migration, so the new function appears under `Functions`.

### 4.4 Supabase Auth settings (owner action, not changed by this design)

- Keep JWT expiry short (default 3600 s). An access token issued before deletion stays cryptographically valid until
  it expires (R-2).
- Email confirmation must stay on (already required by invitations, database-design §8 item 5).

### 4.5 Hosting legal pages

The stores need a public URL for the privacy policy, and Google Play needs one for account deletion requests. This
needs a static page (for example the admin web app's public route or a simple static host). That is a decision for
the owner and Athel. It doesn't block the in-app work.

### 4.6 What the admin dashboard will see (for Athel)

After deletion, a report shows no reporter: `get_report_reporter_contact()` returns an empty set. Comments keep
`from_reporter = true`. The admin UI should show something like "Reporter account deleted" instead of an error when
contact details are empty. No admin code is changed by this design.

---

## 5. Data deletion versus anonymization recommendations

| Data                                                       | Recommendation                               | Reason                                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth account (email, password, metadata, sessions)         | **Delete**                                   | Not needed once the account is gone                                                                                                        |
| `profiles`, `profile_contacts`                             | **Delete** (cascade)                         | Direct identifiers                                                                                                                         |
| `notifications`, `push_tokens`                             | **Delete** (cascade)                         | Only useful to the account                                                                                                                 |
| Confirmations, follows                                     | **Delete** and decrement counters            | Personal activity; counters stay consistent                                                                                                |
| Reports (category, status, location, description, address) | **Retain, de-linked** (`reporter_id → null`) | Municipal operational records, possibly with legal retention duties; other residents' confirmations depend on them. **Owner decision D-1** |
| Citizen photos                                             | **Retain, de-linked**                        | Evidence of the reported problem; EXIF already stripped; path has no user id                                                               |
| Comments from the reporter                                 | **Retain, de-linked** (`author_id → null`)   | Part of the case history                                                                                                                   |
| Status history                                             | **Retain, de-linked**                        | Workflow record                                                                                                                            |
| `audit_logs`                                               | **Retain unchanged**                         | Append-only by design. The citizen UUID is never shown, and after deletion it no longer resolves to anyone                                 |
| Backups / PITR                                             | Expire on the provider's schedule            | Must be disclosed in the privacy policy                                                                                                    |
| Device data                                                | **Delete** on success                        | Session, draft for that user id, password-recovery flag                                                                                    |

**Residual risk:** free text (descriptions and comments) and photos can still identify a person, for example "the
pothole outside my house at …" or a face in the photo. This can't be scrubbed automatically. Options for D-1:

- **D-1a (recommended default):** retain everything above as de-linked municipal records, and say so before deletion
  and in the privacy policy. Free-text retention period: set by municipality and legal (database-design §8 item 8).
- **D-1b:** additionally **withdraw** the user's reports that are still `submitted` (never reviewed). Delete the
  report, its photos (Storage API) and comments, since the municipality never acted on them. This needs extra SQL
  (children have no `ON DELETE CASCADE` to `reports`) plus Storage deletes in the Edge Function.

---

## 6. Required screens and navigation

| Route                                                     | Access                                                                            | Content                                                                                                                                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `(tabs)/profile` (change)                                 | signed in                                                                         | New section **Privacy & legal**: Privacy policy, Terms of use, **Delete account** (`tone="danger"`, hidden in dev preview). Placed before _General / Sign out_.                                                                |
| `account/delete` (new)                                    | signed in, inside `account` stack                                                 | Lists what will be deleted and what will be kept, a password field, a danger button, the native confirm dialog, a loading state, and translated errors. Staff accounts see a "contact your municipality admin" notice instead. |
| `legal/privacy`, `legal/terms` (new, `legal/_layout.tsx`) | **every auth state** (registered outside `Stack.Protected`, like `auth/callback`) | Scrollable, localized, versioned text with a "Last updated" date and a privacy contact. Reached from Profile and from sign-up.                                                                                                 |
| `sign-up` (change)                                        | signed out                                                                        | Notice under the button: "By creating an account you agree to the [Terms of use] and acknowledge the [Privacy policy]". Links are inline `Text` nodes, so RTL ordering works.                                                  |
| `sign-up` / `sign-in` (change)                            | signed out                                                                        | One-time success notice after deletion (an auth-context flag like `hasSignedOut`, e.g. `accountDeleted`).                                                                                                                      |

RTL/LTR: all new screens use the existing `Screen`, `Text`, `SettingsRow`, `Notice` and `Button` components, which
inherit `direction` from the root. Don't use hard-coded `left`/`right` or `textAlign: 'left'`. Use `start`/`end`.

Legal text storage: put long texts in `packages/shared/src/legal/{privacy,terms}.ts`, keyed by locale with a
`version` and `updatedAt`, rather than in `messages/*.ts`. Use the same derived type, so a missing locale fails to
compile. The web copy (§4.5) is generated from the same source.

---

## 7. Translation requirements

New keys go in `packages/shared/src/i18n/messages/{en,he,ar}.ts`. Arabic needs native review, like D-012. The Hebrew
text keeps the plural address form already used in the app ("אתם").

```text
profile.privacyAndLegal          "Privacy & legal"
profile.privacyPolicy            "Privacy policy"
profile.termsOfUse               "Terms of use"
profile.deleteAccount            "Delete account"

legal.privacyTitle / legal.termsTitle
legal.lastUpdated                "Last updated: {date}"
legal.privacyContact             "Privacy requests: {email}"
legal.draftNotice                "Draft – not yet reviewed by counsel" (shown in dev builds only)

auth.consentPrefix               "By creating an account you agree to the"
auth.consentTerms                "Terms of use"
auth.consentJoin                 "and acknowledge the"
auth.consentPrivacy              "Privacy policy"
auth.accountDeleted              "Your account was deleted."

deleteAccount.title              "Delete your account"
deleteAccount.intro
deleteAccount.deletedHeading     "What will be deleted"
deleteAccount.deletedItems       (name, email, phone, home area, notifications, follows/confirmations, sign-in)
deleteAccount.retainedHeading    "What the municipality keeps"
deleteAccount.retainedItems      (reports, photos and comments you sent, no longer linked to you)
deleteAccount.irreversible       "This can't be undone."
deleteAccount.passwordLabel      "Enter your password to continue"
deleteAccount.submit             "Delete my account"
deleteAccount.deleting           "Deleting your account…"
deleteAccount.confirmTitle       "Delete account permanently?"
deleteAccount.confirmMessage
deleteAccount.confirm            "Delete"
deleteAccount.cancel             "Cancel"
deleteAccount.staffBlocked       "This account is also a municipal staff account. Ask your municipality admin to remove your staff access first."
deleteAccount.errors.wrongPassword
deleteAccount.errors.reauthRequired   "For your security, enter your password again."
deleteAccount.errors.network
deleteAccount.errors.unknown
```

`authErrors.invalidCredentials` and `authErrors.network` can be reused where the wording fits. iOS permission strings
already exist in all three languages, so no change is needed there.

---

## 8. Security risks

| ID   | Risk                                                                                                      | Mitigation                                                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-1  | Service-role key leaks to the client                                                                      | Key only in Edge Function secrets; a test or grep in `pnpm check` rejects `service_role`/`SERVICE_ROLE` under `apps/` and `packages/`            |
| R-2  | A stolen or old access token deletes the account                                                          | Function requires a password login in the last 5 minutes (`amr`), POST only, and the mobile app asks for the password again                      |
| R-3  | An access token issued before deletion stays valid until expiry                                           | Profile rows are gone, so RLS returns nothing and `submit_report` fails on the FK. Keep JWT expiry short; the client signs out locally           |
| R-4  | `auth.admin.deleteUser` fails because the user owns Storage objects (Supabase documents this restriction) | **Verify on dev with synthetic users.** If confirmed, `prepare_account_deletion` clears `owner`/`owner_id` on that user's `report-media` objects |
| R-5  | `prepare_account_deletion` callable by API roles                                                          | Revoked from `public`/`anon`/`authenticated`; schema-guards assertion                                                                            |
| R-6  | Staff deletion bypasses audited offboarding                                                               | Blocked in SQL (§3.3)                                                                                                                            |
| R-7  | Partial failure (prepare done, delete failed)                                                             | Prepare is idempotent and harmless; the client shows a retry option; function logs a non-personal error code                                     |
| R-8  | Re-identification from retained free text or photos                                                       | Disclosed to the user; retention period per D-1; withdrawal option D-1b                                                                          |
| R-9  | Supabase `auth.audit_log_entries` may keep the email or IP after deletion                                 | Verify on dev; document in the privacy policy                                                                                                    |
| R-10 | Enumeration or abuse of the function                                                                      | JWT required, no user id parameter (always the caller), Supabase rate limits on sign-in for the re-auth step                                     |
| R-11 | A shared device keeps the deleted user's draft or photos                                                  | Remove `smart-city.report-draft.v*.{userId}` and the recovery key, and clear pending photos, on success                                          |

---

## 9. Testing plan

**Database (`supabase/tests/account-deletion.test.ts`, PGlite):**

- `authenticated` and `anon` cannot execute `prepare_account_deletion`; `service_role` can.
- Citizen with reports, comments, photos (objects rows), confirmations and follows: after prepare + deleting the
  `auth.users` row, `profiles`, contacts, notifications, push tokens, confirmations and follows are gone. Reports,
  comments, history and attachments remain with null user references, and counters are decremented exactly once.
- A second citizen's confirmation on the same report is unaffected.
- Staff or platform-admin user → `staff_account` / `platform_admin`, no rows changed.
- Staff can still read the de-linked report; `get_report_reporter_contact` returns zero rows; `get_public_reports`
  unchanged.
- Idempotency: running prepare twice doesn't change the counters again.
- `schema-guards` updated: RPC allowlist and the new service-role-only check.

**Edge Function (Deno tests with a mocked Supabase client):** missing or invalid JWT → 401; stale `amr` →
`reauth_required`; GET → 405; staff → mapped code; success path calls prepare then `deleteUser` with the caller's id
only.

**`packages/api`:** `deleteMyAccount` maps each code to an `ApiError` kind (fake client, like the existing tests).

**Mobile (vitest, pure logic):** deletion orchestration (re-auth → invoke → local cleanup) with injected deps;
wrong password stops before invoke; local keys removed only on success.

**Manual on `smart-city-dev`, synthetic accounts only:** full flow in he/ar/en, with RTL screenshots of the three new
screens; check that the user can't sign in again and that the email can register again; staff account blocked;
airplane mode mid-flow; R-4 and R-9 checks; admin dashboard check with Athel.

`pnpm check` must pass before any commit.

---

## 10. Implementation stages

| Stage | Work                                                                                                                                                                                                                                                                                      | Gate                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0     | Owner decisions: **D-1** retention / withdrawal of `submitted` reports; **D-2** immediate delete (recommended) vs grace period; **D-3** where the legal web page is hosted; **D-4** record terms acceptance in the DB (default: no); privacy contact address and data controller identity | Owner                                         |
| 1     | Migration + DB tests + schema-guards; regenerate types                                                                                                                                                                                                                                    | Owner approves SQL before it's applied to dev |
| 2     | Edge Function + tests; deploy to dev; verify R-4 and R-9 with synthetic users                                                                                                                                                                                                             | Owner approves deploy                         |
| 3     | `packages/api` `deleteMyAccount`                                                                                                                                                                                                                                                          | —                                             |
| 4     | Mobile: `account/delete`, Profile section, auth cleanup, translations                                                                                                                                                                                                                     | —                                             |
| 5     | Legal: `packages/shared/src/legal`, `legal/*` screens, sign-up consent; placeholder text marked as a draft until counsel provides the final text                                                                                                                                          | Legal text from counsel                       |
| 6     | Manual QA in three languages, store checklists (Apple 5.1.1(v), Google Play account-deletion and data-safety forms), decision log entry D-013                                                                                                                                             | Owner review, then commit                     |

---

## 11. Files that would change

**New**

- `supabase/migrations/2026111X000100_account_deletion.sql`
- `supabase/functions/delete-account/index.ts` (+ `deno.json` / test file)
- `supabase/tests/account-deletion.test.ts`
- `packages/api/src/me/account.ts`, `packages/api/src/me/account.test.ts`
- `packages/shared/src/legal/privacy.ts`, `packages/shared/src/legal/terms.ts`, `packages/shared/src/legal/index.ts`
- `apps/mobile/src/app/account/delete.tsx`
- `apps/mobile/src/app/legal/_layout.tsx`, `apps/mobile/src/app/legal/privacy.tsx`, `apps/mobile/src/app/legal/terms.tsx`
- `apps/mobile/src/lib/account-deletion.ts`, `apps/mobile/src/lib/account-deletion.test.ts`

**Changed**

- `supabase/tests/schema-guards.test.ts`
- `packages/api/src/database.types.ts` (regenerated), `packages/api/src/index.ts`, `packages/api/src/errors/*` (new codes, if needed)
- `packages/shared/src/i18n/messages/en.ts`, `he.ts`, `ar.ts`; `packages/shared/src/index.ts` (export legal)
- `apps/mobile/src/app/(tabs)/profile.tsx`
- `apps/mobile/src/app/account/_layout.tsx`
- `apps/mobile/src/app/_layout.tsx` (register `legal` outside the guard)
- `apps/mobile/src/app/sign-up.tsx` (consent notice, deleted-account notice), `apps/mobile/src/app/sign-in.tsx` (deleted-account notice)
- `apps/mobile/src/lib/auth.tsx` (`accountDeleted` flag, local cleanup)
- `docs/decisions.md` (D-013), `docs/database-design.md` (§8 retention, new function), `supabase/README.md` (function deploy)

**Not changed:** `apps/admin/**` and existing migrations 0001–0008.
