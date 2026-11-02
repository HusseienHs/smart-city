# Database schema & security design

> **Status:** implemented in `supabase/migrations` (6 migrations) and covered by 92 automated
> security tests. **Not yet applied to the hosted project** — see §9 before applying.
> Environment constraint (D-007): the hosted Frankfurt project holds **synthetic data only**.

## 1. Security principles

1. **Postgres is the only enforcement point.** Every table has RLS enabled in the migration
   that creates it. Apps hold only the publishable key and the user's JWT.
2. **Deny by default, and undo Supabase's broad defaults.** Supabase grants `ALL` on new
   tables and `EXECUTE` on new functions to `anon`/`authenticated`. Every migration revokes
   these and re-grants precisely (column-level where it matters). Tests assert the exact
   resulting privileges.
3. **Tenant consistency is enforced by foreign keys.** Every municipality-owned row carries
   `municipality_id`; references between tenant rows are composite FKs
   `(x_id, municipality_id) → x(id, municipality_id)`. A report in A physically cannot point at
   a department, employee, neighborhood or original report of B — even if a policy had a bug.
4. **Citizens never read tenant tables directly.** They use `SECURITY DEFINER` functions with
   explicit, minimal column lists. Staff read tables directly, scoped by RLS.
5. **Sensitive writes only through RPCs.** No API role has `INSERT/UPDATE/DELETE` on reports,
   history, attachments, comments, confirmations, followers or notifications. RPCs validate
   permission + state and write history, notifications and audit atomically.
6. **Safe definer functions.** Every function in `public` and `private` pins
   `search_path = ''` and schema-qualifies all references. RLS helpers live in the unexposed
   `private` schema and only answer questions about the _calling_ user. Internal write helpers
   (`write_audit`, `notify_report_followers`, trigger functions) are not executable by API roles.
7. **Uniform denials.** "Does not exist" and "not allowed" return the same error, so ids
   cannot be probed.
8. **Everything sensitive is audited** in an append-only `audit_logs` table (blocked for
   `UPDATE`/`DELETE`/`TRUNCATE` even for the table owner, by trigger).

## 2. Roles

| Role                 | Scope                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon`               | Public reference data: active municipalities, neighborhoods, departments, enabled categories, published announcements                           |
| citizen (signed in)  | Own profile & phone, own reports (via RPC), public reports (via RPC), own notifications, confirm/follow                                         |
| `employee`           | Reports of their department or assigned to them; status updates on those; drafts for their department                                           |
| `intake_dispatcher`  | **Unassigned** reports only; may set `under_review`/`rejected`, route to a department, set priority                                             |
| `department_manager` | Reports of their department; assign within the department or return to intake; publish department content                                       |
| `municipality_admin` | Everything in their municipality: all reports, staff, departments, settings, audit log, all content                                             |
| platform admin       | Read-only access to tenant _structure_ (municipalities, departments, staff). **No access to reports, citizen data, photos or exact locations.** |

Staff membership = an active row in `employees`. Checked on every query (not cached in the
JWT), so deactivation takes effect immediately.

## 3. Schema

`uuid` PKs, `created_at`/`updated_at` with trigger, localized text as `jsonb`
`{"he","ar","en"}` (Hebrew required, validated), PostGIS `geography(…, 4326)` (WGS84,
provider-independent — D-008).

| Migration               | Contents                                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…000100_foundation`    | PostGIS (in `extensions`), `private` schema, enums, `set_updated_at`, `is_localized_text`, `round_location`                                                                                                                                                                |
| `…000200_tenancy`       | `municipalities`, `neighborhoods`, `profiles` (+ sign-up trigger), `profile_contacts`, `platform_admins`, `departments`, `employees` (+ escalation guards), `audit_logs`, RLS helpers                                                                                      |
| `…000300_notifications` | `notifications` (Realtime), `push_tokens`, `register_push_token()`                                                                                                                                                                                                         |
| `…000400_reports`       | `report_categories` (+ catalog), `municipality_report_categories`, `report_status_transitions` (+ graph), `reports`, `report_tracking_counters`, `report_attachments`, `report_comments`, `report_status_history`, `report_confirmations`, `report_followers`, report RPCs |
| `…000500_content`       | `announcements` with draft → published → archived, `set_announcement_status()`                                                                                                                                                                                             |
| `…000600_storage`       | Buckets `report-media` (private) and `public-content` (public read), storage policies                                                                                                                                                                                      |

Key columns of `reports`: `tracking_number` (`CODE-YYYY-NNNNNN`, per-municipality yearly
counter), `reporter_id` (`on delete set null`), `location` (exact), `public_location`
(generated, ~50 m grid, indexed), `visibility`, `status`, `priority`,
`suggested_department_id`, `department_id`, `assignee_id`, `rejection_reason`,
`duplicate_of_id`, counters, and `first_response_at` / `resolved_at` / `closed_at` for analytics.

Table constraints include: an assignee requires a department; a rejection reason exists **iff**
the status is `rejected`; a duplicate reference only for `duplicate` rejections; department-scoped
staff roles require a department.

## 4. Access matrix

✅ allowed · ◐ restricted · — denied. "RPC" = through a function, never the table.

| Data                                                                    | anon | Citizen                                                      | Employee                      | Dispatcher           | Dept manager              | Muni admin     | Other municipality |
| ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------ | ----------------------------- | -------------------- | ------------------------- | -------------- | ------------------ |
| Reference data (municipalities, neighborhoods, departments, categories) | ✅   | ✅                                                           | ✅                            | ✅                   | ✅                        | ✅ + edit      | public only        |
| Own profile / own phone                                                 | —    | ✅                                                           | ✅                            | ✅                   | ✅                        | ✅             | —                  |
| Colleague names                                                         | —    | —                                                            | ✅                            | ✅                   | ✅                        | ✅             | —                  |
| Citizen profiles & phones                                               | —    | —                                                            | ◐ RPC, handlers only, audited | —                    | ◐ RPC, audited            | ◐ RPC, audited | —                  |
| Own reports                                                             | —    | ◐ RPC (no priority/assignee/department)                      |                               |                      |                           |                |                    |
| Others' public reports                                                  | —    | ◐ RPC: category, status, ~50 m location, date, confirmations |                               |                      |                           |                |                    |
| Reports (table) incl. exact location                                    | —    | —                                                            | ◐ dept/assigned               | ◐ unassigned         | ◐ dept                    | ✅             | —                  |
| Change status                                                           | —    | —                                                            | ◐                             | ◐ review/reject only | ◐                         | ✅             | —                  |
| Assign / route                                                          | —    | —                                                            | —                             | ◐ route only         | ◐ within dept / to intake | ✅             | —                  |
| Internal comments & notes                                               | —    | —                                                            | ✅ (accessible reports)       | ✅                   | ✅                        | ✅             | —                  |
| Report photos                                                           | —    | ◐ own reports                                                | ◐                             | ◐                    | ◐                         | ✅             | —                  |
| Drafts                                                                  | —    | —                                                            | ◐ own dept                    | —                    | ◐ own dept                | ✅             | —                  |
| Publish content                                                         | —    | —                                                            | —                             | —                    | ◐ own dept                | ✅             | —                  |
| Audit log                                                               | —    | —                                                            | —                             | —                    | —                         | ✅ read        | —                  |

## 5. Decisions implemented (review of 2026-11-02)

**Visibility (department-scoped + intake).** `private.can_access_report()` is the single
definition. With `auto_route_reports = false` (default), new reports land in the intake queue
with a _suggested_ department; dispatchers route them. Municipalities can enable direct routing.

**Public reports & privacy.** Citizens choose `public`/`private`; `noise` defaults to private
(catalog column `default_visibility`, mirrored by `SENSITIVE_REPORT_CATEGORIES`). Public data is
served only by `get_public_reports()`:

- **Location** is the generated `public_location`, snapped to a fixed ~50 m grid. The grid is
  deterministic, so averaging repeated queries can't recover the exact point (random jitter
  could be averaged away). **Filtering also uses the rounded location**, so a shrinking
  bounding box can't be used to locate the exact point. Requests are limited to ≤ 0.5° boxes
  and ≤ 500 rows.
- **Never returned:** reporter, contact details, description, address, exact location,
  priority, department, assignee and photos. Descriptions are excluded because free text
  often contains names and addresses.
- Rejected and duplicate reports are hidden. Resolved and closed reports stay visible for 30 days.
- Requires sign-in in the MVP (not `anon`), to limit bulk scraping.

**Exact coordinates** are only in `reports.location`. Readable by the reporter (own report
through an RPC) and by staff the RLS policy authorizes. Not by other citizens, other
departments, other municipalities or platform admins.

**Photos** are never public. The `report-media` bucket is private. Storage policies allow
reads only by the reporter and by staff with access to the report, and uploads only by the
reporter while the report is `submitted` (max 5) or by handling staff while work is in
progress. `add_report_attachment()` checks that the path matches the report and the file
actually exists.

**Publishing.** Drafts: any staff member, for their own department (admins also
municipality-wide). Publish/archive only through `set_announcement_status()`: admins for
everything, managers for their department. Publishing, archiving and edits to published
content are audited.

**Resolution / rejection.** `update_report_status()` requires a **public note** (≥ 5 chars)
for `resolved` and `rejected`, and a **rejection reason** for `rejected` (`duplicate` also
requires the original report, in the same municipality). Completion photos are optional;
`municipalities.require_completion_photo` (default false) enforces them when enabled. Every
status change notifies the report's followers (the reporter follows automatically), except
the actor.

**Phone numbers** live in `profile_contacts` (own-row RLS only), separate from `profiles`, so
no "colleagues" or other policy can expose them. They are optional, and reporting works
without one. Staff get them only via `get_report_reporter_contact()`, which is restricted to
staff _handling_ the report (not dispatchers) and writes an audit entry on every successful
access.

## 6. Escalation guards

- Only `municipality_admin` can create or modify staff memberships, and only in their own municipality.
- Nobody can create a membership for themselves, or change their own role, department or active status.
- The last active admin can't be removed: an admin can't deactivate themselves, and a deactivated admin loses all power.
- `platform_admins`, `municipalities.code`/`status`, `employees.user_id`/`municipality_id`,
  report workflow columns and `audit_logs` are not writable through the API.
- Requests without a verified user id are treated as unauthenticated.

## 7. Automated tests (`supabase/tests`, 92 tests)

Tests run in-process on **PGlite** (Postgres compiled to WebAssembly) with PostGIS. That
means no Docker and no network, and the hosted project is never touched. A test-only shim
(`tests/support/supabase-shim.sql`) provides what Supabase provides: the `anon`,
`authenticated` and `service_role` roles, `auth.uid()` from JWT claims, `auth.users`, the
storage schema, and Supabase's broad default privileges. Every statement runs as a specific
actor (`SET ROLE` + `request.jwt.claims`), like an API request, inside a transaction that is
rolled back.

| Suite                    | Covers                                                                                                                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema-guards` (12)     | RLS on every table; exact privilege allowlists for anon/authenticated; protected columns; no anon RPCs; exact RPC allowlist; pinned `search_path`; internal helpers unreachable; enums, categories and workflow equal `packages/shared`; seed is fictional                                          |
| `tenant-isolation` (16)  | B's staff see none of A's rows in 9 tables and none of A's drafts; every RPC denied cross-tenant; cross-tenant assignment rejected; composite FKs hold even for the owner; staff and settings management denied; audit log scoped                                                                   |
| `report-access` (11)     | Role/department visibility matrix; deactivation; dispatcher and manager limits; employees can't assign; assignee must belong to the department                                                                                                                                                      |
| `report-workflow` (19)   | Submission validation, routing, neighborhood detection, rate limit, sensitive-category default; invalid transitions; public note, rejection reason, duplicate and completion-photo rules; history, audit and notifications; reporter view hides internal fields, notes and comments; confirm/follow |
| `public-exposure` (12)   | Private reports never listed; column allowlist; no identity, contact or description leaks; 50 m rounding; bounding-box probing fails; size limits; anon denied; exact coordinates only for authorized staff; photo upload/read matrix; private bucket; completion photos                            |
| `contact-access` (4)     | Handlers get name and phone, and each access is audited; 8 unauthorized actors denied with nothing logged; phones in no staff-readable table; own-row phone management; reporting without a phone                                                                                                   |
| `role-escalation` (11)   | Self-promotion, self-membership, cross-municipality self-grant, last admin, platform admin, 12 protected writes, append-only audit, own profile only, missing identity                                                                                                                              |
| `content-publishing` (7) | Draft/publish matrix per role, direct status writes blocked, audit of publish, archive and edit, draft visibility                                                                                                                                                                                   |

**Mutation check:** three security bugs were injected on purpose: the dispatcher seeing all
reports, exact coordinates in the public function, and a missing `REVOKE`. The suite caught
each one (3, 1 and 6 failing tests).

## 8. Known limitations & risks

1. **PGlite runs Postgres 18; hosted Supabase runs 17**, and the shim is a model of
   Supabase, not Supabase itself. The migrations use no 18-only features, but §9 must pass on
   the hosted project before we rely on it.
2. **Storage API behavior isn't covered:** the tests exercise storage _policies_ on
   `storage.objects`, not the Storage HTTP API (upload limits, MIME checks, signed URLs).
   API-level integration tests come next (§10).
3. **`add_report_attachment` reads `storage.objects`** as the function owner. This works if
   the hosted `postgres` role can read that table, as in standard Supabase projects. Verify in §9.
4. **Orphaned uploads:** a file uploaded but never registered stays in storage. A cleanup job
   is needed before production.
5. **Public reports can still be scraped** by tiling many small boxes. The data exposed is
   minimal by design; add rate limiting at the API gateway before launch.
6. **Free text** (description, comments) can contain personal data. It's never public, but
   staff see it, so retention rules are needed before real data.
7. **The rate limit is per user**, and anyone can create more accounts. Add CAPTCHA or
   phone verification at sign-up before a public launch.
8. **Platform admins have no report access**, so production support will need a deliberate,
   audited break-glass procedure.

## 9. Before applying to the hosted project (checklist)

1. Confirm the dev project holds no real data (D-007).
2. `supabase link --project-ref <dev-project>` (CLI; no Docker needed), then
   `supabase db push --dry-run` and review the output.
3. `supabase db push`, followed by `supabase db push --include-seed` only on the dev project.
4. Run the Security Advisor and Performance Advisor in the dashboard; expect no RLS or
   `search_path` findings.
5. Verify the shim assumptions on the hosted project: default privileges were revoked as
   expected (re-run the privilege queries from `schema-guards` via the SQL editor), the
   `postgres` role can read `storage.objects` inside `add_report_attachment`, and
   `notifications` is in the `supabase_realtime` publication.

## 10. Next steps

- API-level integration tests (supabase-js against the dev project: Auth, PostgREST,
  Storage, Realtime), with throwaway synthetic users.
- CI (GitHub Actions): `pnpm check` on every PR, which includes the database tests.
- Generate database types into `packages/shared` (`supabase gen types --linked`).
