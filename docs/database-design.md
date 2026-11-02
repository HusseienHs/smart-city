# Database schema & security design

> **Status:** implemented in `supabase/migrations` (6 migrations) and covered by 131 automated
> security tests. **Not yet applied to the hosted project** — see §9 before applying.
> Environment constraint (D-007): the hosted Frankfurt project holds **synthetic data only**.
> Revised after the pre-deployment review (findings F1–F9 and the department-transfer rule, §5.1).

## 1. Security principles

1. **Postgres is the only enforcement point.** Every table has RLS enabled in the migration
   that creates it. Apps hold only the publishable key and the user's JWT.
2. **Deny by default, and undo Supabase's broad defaults.** Supabase grants `ALL` on new
   tables and `EXECUTE` on new functions to `anon`/`authenticated`. Every migration revokes
   these and re-grants precisely, **column by column** where a table holds identifying data.
   Tests assert the exact resulting privileges.
3. **Tenant consistency is enforced by foreign keys.** Every municipality-owned row carries
   `municipality_id`; references between tenant rows are composite FKs
   `(x_id, municipality_id) → x(id, municipality_id)`. A report in A physically cannot point at
   a department, employee, neighborhood or original report of B — even if a policy had a bug.
4. **Nobody reads anyone else's identity directly.** Citizens use `SECURITY DEFINER` functions
   with minimal column lists. Staff read tenant tables, but the columns that identify a
   citizen (`reporter_id`, comment/history/upload authors) are not granted. Staff actions are
   attributed by _employee id_. Profiles are own-row only.
5. **Sensitive writes only through RPCs.** No API role can write reports, history,
   attachments, comments, confirmations, followers, notifications, staff memberships or roles
   directly. RPCs validate permission + state and write history, notifications and audit atomically.
6. **Safe definer functions.** Every function in `public` and `private` pins
   `search_path = ''` and schema-qualifies all references. Helpers live in the unexposed
   `private` schema. **Nothing in `private` is executable by `anon`.** `authenticated` can
   execute only the helpers that RLS policies and check constraints call, and those only
   answer questions about the _calling_ user.
7. **Uniform denials.** "Does not exist" and "not allowed" return the same error, so ids
   cannot be probed.
8. **Everything sensitive is audited** in an append-only `audit_logs` table, blocked for
   `UPDATE`/`DELETE`/`TRUNCATE` even for the table owner. API roles read it only through
   `get_audit_log()`, which redacts citizen identities.

## 2. Roles

| Role                 | Scope                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `anon`               | Public reference data: active municipalities, neighborhoods, departments, enabled categories, published announcements (without author ids)                                                                   |
| citizen (signed in)  | Own profile & phone, own reports (via RPC), public reports (via RPC), own notifications, confirm/follow, own staff invitations                                                                               |
| `employee`           | Reports of their **current** department; status updates on those; drafts for their department                                                                                                                |
| `intake_dispatcher`  | **Unassigned** reports only: `under_review`/`rejected`, route to a department, set priority. **Cannot draft content.**                                                                                       |
| `department_manager` | Reports of their department; assign within it or return to intake; publish their department's content                                                                                                        |
| `municipality_admin` | Everything in their municipality: all reports, staff (invitations, roles, transfers, deactivation), departments, settings, all content, audit log                                                            |
| platform admin       | Read-only tenant _structure_ (municipalities, departments, staff) and an operational audit view. **No access to reports, citizen data, photos, exact locations, tracking numbers or report audit payloads.** |

Staff membership = an active row in `employees`, created **only** by the intended user
accepting an invitation. Checked on every query (not cached in the JWT), so deactivation and
transfers take effect immediately.

## 3. Schema

`uuid` PKs, `created_at`/`updated_at` with trigger, localized text as `jsonb`
`{"he","ar","en"}` (Hebrew required, validated), PostGIS `geography(…, 4326)` (WGS84,
provider-independent — D-008).

| Migration               | Contents                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…000100_foundation`    | PostGIS (in `extensions`), `private` schema, enums, `set_updated_at`, `is_localized_text`, `round_location`                                                                                                                                                                                                                        |
| `…000200_tenancy`       | `municipalities`, `neighborhoods`, `profiles` (+ sign-up trigger), `profile_contacts`, `platform_admins`, `departments`, `employees` (+ escalation guards), `staff_invitations`, `audit_logs` (+ `actor_kind`), RLS helpers, `get_colleagues()`, invitation RPCs, `get_audit_log()`                                                |
| `…000300_notifications` | `notifications` (Realtime), `push_tokens`, `register_push_token()`                                                                                                                                                                                                                                                                 |
| `…000400_reports`       | `report_categories` (+ catalog), `municipality_report_categories`, `report_status_transitions` (+ graph), `reports`, `report_tracking_counters`, `report_attachments`, `report_comments`, `report_status_history`, `report_confirmations`, `report_followers`, report RPCs, `set_employee_role()`, release-on-deactivation trigger |
| `…000500_content`       | `announcements` (draft → published → archived, `image_path`), `set_announcement_status()`                                                                                                                                                                                                                                          |
| `…000600_storage`       | Buckets `report-media` (private), `content-drafts` (private), `public-content` (public read); storage policies; private-schema EXECUTE hardening                                                                                                                                                                                   |

Key columns of `reports`: `tracking_number` (`CODE-YYYY-NNNNNN`, per-municipality yearly
counter), `reporter_id` (internal, `on delete set null`, **not readable by any API role**),
`location` (exact), `public_location` (generated, ~50 m grid, indexed), `visibility`, `status`,
`priority`, `suggested_department_id`, `department_id`, `assignee_id`, `rejection_reason`,
`duplicate_of_id`, counters, and `first_response_at` / `resolved_at` / `closed_at` for analytics.

Staff-visible attribution: `report_comments.author_employee_id` / `from_reporter`,
`report_status_history.changed_by_employee_id`. The user-id columns (`author_id`,
`changed_by`, `uploaded_by`) exist for internal use only and are never granted.

Table constraints include:

- an assignee requires a department;
- a rejection reason exists **iff** the status is `rejected`;
- a duplicate reference only for `duplicate` rejections;
- department-scoped staff roles require a department;
- `announcements.image_path` must sit inside that announcement's own folder.

**Client note:** column-level grants mean `select *` is denied on `reports`, its child
tables, `employees` and `announcements`. Clients must list the columns they need.

## 4. Access matrix

✅ allowed · ◐ restricted · — denied. "RPC" = through a function, never the table.

| Data                                                                    | anon | Citizen                                                      | Employee                 | Dispatcher           | Dept manager              | Muni admin                 | Other municipality |
| ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------ | ------------------------ | -------------------- | ------------------------- | -------------------------- | ------------------ |
| Reference data (municipalities, neighborhoods, departments, categories) | ✅   | ✅                                                           | ✅                       | ✅                   | ✅                        | ✅ + edit                  | public only        |
| Own profile / own phone                                                 | —    | ✅                                                           | ✅                       | ✅                   | ✅                        | ✅                         | —                  |
| Colleague names (active staff only)                                     | —    | —                                                            | ◐ RPC                    | ◐ RPC                | ◐ RPC                     | ◐ RPC                      | —                  |
| Other people's profiles (home area, language)                           | —    | —                                                            | —                        | —                    | —                         | —                          | —                  |
| Reporter identity & phone                                               | —    | —                                                            | ◐ RPC, own dept, audited | —                    | ◐ RPC, audited            | ◐ RPC, audited             | —                  |
| Own reports                                                             | —    | ◐ RPC (no priority/assignee/department)                      |                          |                      |                           |                            |                    |
| Others' public reports                                                  | —    | ◐ RPC: category, status, ~50 m location, date, confirmations |                          |                      |                           |                            |                    |
| Reports (table) incl. exact location, without reporter id               | —    | —                                                            | ◐ own dept               | ◐ unassigned         | ◐ own dept                | ✅                         | —                  |
| Change status                                                           | —    | —                                                            | ◐                        | ◐ review/reject only | ◐                         | ✅                         | —                  |
| Assign / route                                                          | —    | —                                                            | —                        | ◐ route only         | ◐ within dept / to intake | ✅                         | —                  |
| Internal comments & notes                                               | —    | —                                                            | ✅ (accessible reports)  | ✅                   | ✅                        | ✅                         | —                  |
| Report photos                                                           | —    | ◐ own reports                                                | ◐                        | ◐                    | ◐                         | ✅                         | —                  |
| Drafts (incl. draft images)                                             | —    | —                                                            | ◐ own dept               | —                    | ◐ own dept                | ✅                         | —                  |
| Publish content / public images                                         | —    | —                                                            | —                        | —                    | ◐ own dept                | ✅                         | —                  |
| Staff invitations, roles, transfers                                     | —    | ◐ accept/decline own                                         | —                        | —                    | —                         | ✅                         | —                  |
| Audit log                                                               | —    | —                                                            | —                        | —                    | —                         | ◐ RPC, citizens anonymized | —                  |

## 5. Decisions implemented

### 5.0 Approved design (2026-11-02)

**Visibility (department-scoped + intake).** `private.can_access_report()` is the single
definition. With `auto_route_reports = false` (default), new reports land in the intake queue
with a _suggested_ department, and dispatchers route them. Municipalities can enable direct routing.

**Public reports & privacy.** Citizens choose `public`/`private`; `noise` defaults to private
(catalog column `default_visibility`, mirrored by `SENSITIVE_REPORT_CATEGORIES`). Public data is
served only by `get_public_reports()`:

- **Location** is the generated `public_location`, snapped to a fixed ~50 m grid. The grid is
  deterministic, so averaging repeated queries can't recover the exact point (random jitter
  could be averaged away). **Filtering also uses the rounded location**, so a shrinking
  bounding box can't locate the exact point. Requests are limited to ≤ 0.5° boxes and ≤ 500 rows.
- **Never returned:** reporter, contact details, description, address, exact location,
  priority, department, assignee and photos. Descriptions are excluded because free text
  often contains names and addresses.
- Rejected and duplicate reports are hidden; resolved and closed reports stay visible for 30 days.
- Requires sign-in in the MVP (not `anon`), to limit bulk scraping.

**Exact coordinates** are only in `reports.location`, readable by the reporter (own report,
through an RPC) and by staff the RLS policy authorizes. Not by other citizens, other
departments, other municipalities or platform admins.

**Resolution / rejection.** `update_report_status()` requires an explicit **public note**
(≥ 5 chars) for `resolved` and `rejected`, and a **rejection reason** for `rejected`
(`duplicate` also requires the original report, in the same municipality). Completion photos
are optional; `municipalities.require_completion_photo` (default false) enforces them when
enabled. Every status change notifies the report's followers (the reporter follows
automatically), except the actor.

**Phone numbers** live in `profile_contacts` (own-row RLS only), are optional, and reporting
works without one.

### 5.1 Pre-deployment review fixes (2026-11-03)

**F1 — Reporter identity.**

- `reporter_id` is no longer a staff-readable column. Comment, history and upload authors
  aren't either; staff see `author_employee_id` / `from_reporter` and `changed_by_employee_id`.
- Identity is available only through `get_report_reporter_contact()`. It's restricted to
  staff handling the report (current department or admin, never dispatchers) and audits
  every access.
- Report submissions are audited as `actor_kind = 'citizen'`, even when the reporter is also
  staff, and `get_audit_log()` never returns a citizen's actor id.
- Staff membership requires an invitation **accepted by the intended user**:
  1. An admin inserts into `staff_invitations` (email, role, department). That table has no
     path to staff access.
  2. The user whose **confirmed** email matches calls `accept_staff_invitation()`, which is
     the only code that creates or reactivates a membership.
- Invitations expire after 7 days and can be revoked or declined. An admin can't accept an
  invitation they created.
- `employees` has no INSERT grant. A SECURITY INVOKER guard trigger rejects any
  API-initiated insert, as well as role or department edits.

**F2 — Photo limits.** Uploads go to `…/citizen/` or `…/completion/` folders.

- The storage INSERT policy takes a per-(report, kind) advisory lock, then counts the
  **objects actually in storage**. The cap is 5 per kind.
- The policy function is VOLATILE, so a concurrent upload waits for the lock and then sees
  the committed object.
- The bucket enforces 10 MB and an image MIME allowlist.
- `add_report_attachment()` takes size and type from the stored object's metadata, not
  from the caller, and re-checks them.
- Photo access remains private: the reporter and staff with access to the report.

**F3 — Content images.**

- Draft images live in the **private** `content-drafts` bucket. Whoever may edit the
  announcement uploads and deletes them; municipality staff can read them.
- Publishing an image is a controlled step. After `set_announcement_status('published')`, a
  publisher of that announcement copies its `image_path` into the public bucket. The policy
  accepts only that exact path, only for a published announcement, and only from a publisher.
- Only publishers can delete public images.

**F4 — Colleague privacy.** The profile "colleagues" policy is gone. `get_colleagues()`
returns name, role, department and job title of **active** staff only, and never the home
municipality, neighborhood, language or user id. Non-admin staff see only active
memberships in `employees`, and `employees.user_id` isn't readable.

**F5 — Notifications.** The tracking number is added only to the reporter's own notification.
Other followers receive `{report_id, from_status, to_status}`.

**F6 — Audit log.** No direct read access for API roles.

- `get_audit_log()` gives municipality admins their municipality's log with citizen actors
  anonymized.
- Platform admins get an operational view: report entries carry no entity id and no payload
  (no report details, tracking numbers or reporter references), and citizen actors are
  anonymized.
- The service role keeps full access for incident response.

**F7 — Status notes.** `p_note_is_public` defaults to `false`. Resolving and rejecting still
require an explicitly public note.

**F8 — Announcements.** `created_by` / `published_by` aren't readable by any API role.

**F9 — Dispatchers and content.** Dispatchers can't create drafts. Department employees draft
for their department, managers publish their department's content, and admins publish everything.

**Department transfers.**

- Employees and managers see only their **current** department's reports (assignment no
  longer grants access on its own), so a transfer removes access to the old department immediately.
- Roles and departments change only through `set_employee_role()` (admins, never their own
  record). Open reports assigned to the employee are handed, in the same transaction, to a
  named active member of the old department or back to its queue.
- Deactivation releases open assignments too. Every handover is audited as `report.reassigned`.
- Finished reports keep their historical assignee.

## 6. Escalation guards

- Only `municipality_admin` can invite staff, change roles or departments
  (`set_employee_role`), or deactivate staff — and only in their own municipality.
- Memberships exist only through accepted invitations; no API role can insert into `employees`.
- Nobody can change their own role, department or active status, or accept an invitation they created.
- The last active admin can't be removed. An admin can't deactivate or demote themselves,
  `set_employee_role` refuses to demote the last admin, and a deactivated admin loses all power.
- `platform_admins`, `municipalities.code`/`status`, `employees.user_id`/`municipality_id`/`role`/`department_id`,
  report workflow columns and `audit_logs` are not writable through the API.
- Requests without a verified user id are treated as unauthenticated.

## 7. Automated tests (`supabase/tests`, 131 tests)

Tests run in-process on **PGlite** (Postgres compiled to WebAssembly) with PostGIS. That
means no Docker and no network, and the hosted project is never touched. A test-only shim
(`tests/support/supabase-shim.sql`) provides what Supabase provides: the `anon`,
`authenticated` and `service_role` roles, `auth.uid()` from JWT claims, `auth.users` (with
`email_confirmed_at`), the storage schema, and Supabase's broad default privileges. Every
statement runs as a specific actor (`SET ROLE` + `request.jwt.claims`), like an API request,
inside a transaction that is rolled back.

| Suite                     | Covers                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema-guards` (16)      | RLS on every table; exact privilege allowlists; protected columns; **identifying columns hidden**; no direct audit access; locking upload policy; no anon RPCs; exact RPC allowlist; **private helpers: none for anon, allowlist for authenticated**; pinned `search_path`; enums, categories and workflow equal `packages/shared`; seed is fictional |
| `tenant-isolation` (16)   | B's staff see none of A's rows in 9 tables and none of A's drafts; every RPC denied cross-tenant; cross-tenant assignment rejected; composite FKs hold even for the owner; staff and settings management denied; audit log scoped                                                                                                                     |
| `report-access` (11)      | Role/department visibility matrix; deactivation; dispatcher and manager limits; employees can't assign; assignee must belong to the department                                                                                                                                                                                                        |
| `report-workflow` (22)    | Submission validation, routing, rate limit, sensitive-category default; transitions; note, reason, duplicate and completion-photo rules; history, audit and notifications; **F5 follower notifications; F7 private-by-default notes; citizen actor anonymized**; reporter view; confirm/follow                                                        |
| `public-exposure` (13)    | Private reports never listed; column allowlist; no identity leaks; 50 m rounding; bounding-box probing; anon denied; exact coordinates only for authorized staff; **F2: 5-object cap counted in storage, metadata-based size/type checks**; photo read matrix; completion photos                                                                      |
| `contact-access` (9)      | Handlers get name and phone, audited; 8 unauthorized actors denied; **F1: reporter/author columns unreadable, employee-id attribution; F4: colleague names via RPC only, active staff only, no profile fields**                                                                                                                                       |
| `staff-invitations` (8)   | **F1:** acceptance by the intended confirmed email only; no access before acceptance; revoked, declined and expired invitations; admin-only management; server-controlled fields; no self-acceptance; the reporter-identity bypass is blocked; audit                                                                                                  |
| `department-transfer` (8) | Immediate loss of access to the old department; open reports to queue or a named colleague of the old department; invalid handovers; role change and deactivation release assignments; finished reports keep history; no cross-municipality move                                                                                                      |
| `role-escalation` (11)    | No direct memberships for anyone; non-admins can't change roles; no self role/status change; audited promotion; cross-municipality denied; last admin; platform admin; protected writes; append-only audit; own profile only; missing identity                                                                                                        |
| `content-publishing` (13) | Draft/publish matrix; audit of publish, archive and edit; draft visibility; **F8 author ids hidden; F9 dispatchers can't draft; F3 private draft images, controlled publishing, publisher-only deletion, path binding**                                                                                                                               |
| `audit-log` (4)           | **F6:** no direct access; admins and platform admins only; citizen actors never shown; platform view has no report ids, payloads or tracking numbers                                                                                                                                                                                                  |

**Mutation checks:** security bugs were injected on purpose and each was caught:

- _Original design (3):_ dispatcher sees all reports; exact coordinates in the public
  function; missing `REVOKE`.
- _Review fixes (5):_ staff can read `reporter_id`; photo cap ignores storage; draft images
  publishable before publication; an assignee keeps access after leaving the department;
  followers receive tracking numbers.

## 8. Known limitations & risks

1. **PGlite runs Postgres 18; hosted Supabase runs 17.11**, and the shim is a model of
   Supabase, not Supabase itself. The migrations use no 18-only features, but §9 must pass on
   the hosted project before we rely on it.
2. **The Storage HTTP API is not covered by tests.** The tests exercise storage _policies_ on
   `storage.objects`. Two assumptions need API-level verification:
   - The Storage API inserts the object row with `metadata` (`size`, `mimetype`) in a single
     INSERT, with no follow-up UPDATE. There is deliberately no UPDATE policy.
   - Copying a draft image into `public-content` works with these policies.
3. **Concurrency of the photo cap** is guaranteed by the advisory lock in the policy function.
   PGlite is single-connection, so the tests verify the mechanism (VOLATILE, locks, counts
   storage) but can't race two uploads. Add a concurrent API-level test.
4. **Publishing images is a two-step client flow:** publish, then copy. Archiving or
   unpublishing must be followed by deleting the public copy (only publishers can). Until
   that copy is deleted, it remains reachable by URL.
5. **Invitations depend on email confirmation** being enabled in Supabase Auth. If it were
   disabled, anyone signing up with an invited address could accept the invitation. Verify
   the Auth setting in §9.
6. **Orphaned uploads:** a file uploaded but never registered stays in storage (up to the cap).
   A cleanup job is needed before production.
7. **Public reports can still be scraped** by tiling many small boxes. The data exposed is
   minimal by design; add rate limiting at the API gateway before launch.
8. **Free text** (description, comments) can contain personal data. It's never public, but
   staff see it, so retention rules are needed before real data.
9. **The report rate limit is per account**, and accounts are free. Add CAPTCHA or phone
   verification at sign-up before a public launch.
10. **Platform admins have no report access**, so production support will need a deliberate,
    audited break-glass procedure (the service role).
11. **New private functions are executable by PUBLIC by default.** Each future migration
    that adds one must revoke it; `schema-guards` fails the build otherwise.

## 9. Before applying to the hosted project (checklist)

Every hosted action below (connecting, running queries, pushing) needs the project owner's
explicit approval. Work through the steps in order.

### 9.0 Stop rule

> **If any compatibility, security or verification check fails, STOP.** Do not continue the
> deployment, and do not try to work around the failure on the hosted project.
> Fix problems with a **new migration**, tested locally (`pnpm check`). **Never edit a
> migration that has already been applied** to any shared environment. Then restart this
> checklist from 9.1.

### 9.1 Pre-deployment checks (read-only, before any push)

1. Confirm the dev project holds no real data (D-007).
2. In the dashboard SQL editor, run this read-only query. It changes nothing:

   ```sql
   begin transaction read only;

   select
     current_setting('server_version_num')::int as server_version_num,
     version() as server_version,
     (select rolbypassrls from pg_roles where rolname = 'postgres') as postgres_bypasses_rls,
     exists (
       select 1 from pg_publication where pubname = 'supabase_realtime'
     ) as realtime_publication_exists,
     (select puballtables from pg_publication where pubname = 'supabase_realtime')
       as realtime_all_tables,
     (select extnamespace::regnamespace::text from pg_extension where extname = 'postgis')
       as postgis_schema;

   rollback;
   ```

3. Compare with the expected values. **Any mismatch → STOP (9.0).**

   | Column                        | Expected                                  | Why it matters                                                                                                                              |
   | ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
   | `server_version_num`          | `≥ 150000` (Supabase currently runs 17.x) | `ON DELETE SET NULL (assignee_id)` needs Postgres 15+; tests run on 18                                                                      |
   | `postgres_bypasses_rls`       | `true`                                    | `add_report_attachment` (owned by `postgres`) must read `storage.objects` to confirm an upload exists                                       |
   | `realtime_publication_exists` | `true`                                    | The notifications migration adds `notifications` to it; if it's missing, the step is skipped silently and in-app notifications won't stream |
   | `realtime_all_tables`         | `false`                                   | `alter publication … add table` fails on a `FOR ALL TABLES` publication                                                                     |
   | `postgis_schema`              | `null` (not installed) or `extensions`    | The migrations call `extensions.st_*`; PostGIS installed in another schema would make them fail                                             |

4. In the dashboard, confirm **Authentication → Sign In / Providers → Email → "Confirm email"
   is enabled**. Staff invitations are accepted only by a _confirmed_ matching email.
   **Disabled → STOP.**

### 9.2 Migration preview and push (schema only, no seed data)

Neither command below may include `--include-seed`. Seed data is a separate approval (9.4).

In Supabase CLI v3, `db push` targets the **local** database unless `--remote` is given.

1. `supabase link --project-ref <dev-project>` (CLI; no Docker needed).
2. `supabase db push --remote --dry-run`. Review the output: it must list exactly the six
   committed migrations and nothing else. **Anything unexpected → STOP.**
3. `supabase db push --remote`, only after the dry-run has been reviewed and approved.

### 9.3 Post-deployment verification

1. Run the Security Advisor and Performance Advisor in the dashboard. **Any security
   finding not listed below → STOP.** Expected, intentional findings:
   - _Security:_ INFO "RLS enabled, no policy" on `audit_logs` and `report_tracking_counters`
     (closed to API roles by design). Possibly warnings that SECURITY DEFINER functions are
     exposed through the API: the listed RPCs are definer functions by design.
   - _Performance:_ "unindexed foreign keys" on author/reference columns, and "multiple
     permissive policies" on tables with separate anon/staff/own-row policies. Not security
     issues; tune later.
   - There must be **no** "RLS disabled", "function search_path mutable", "security definer
     view" or "exposed auth.users" findings.
2. Verify the remaining shim assumptions on the hosted project:
   - Supabase's default privileges were revoked as expected: re-run the privilege queries
     from `schema-guards.test.ts` in the SQL editor.
   - `notifications` is in the `supabase_realtime` publication.

### 9.4 Seed data (separate, explicit approval)

The fictional demo seed (`supabase/seed.sql`) is **never** applied as part of the migration
preview or push. Only after 9.1–9.3 have passed, ask the owner for **explicit approval**
before running:

```bash
supabase db push --include-seed   # dev project only — never production
```

## 10. Next steps

- API-level integration tests (supabase-js against the dev project: Auth, PostgREST,
  Storage, Realtime), with throwaway synthetic users.
- CI (GitHub Actions): `pnpm check` on every PR, which includes the database tests.
- Generate database types into `packages/shared` (`supabase gen types --linked`).
