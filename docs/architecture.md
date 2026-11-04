# Architecture

Smart City is a multi-tenant SaaS platform: one codebase and one backend serve many
municipalities, with strict data isolation between them.

```
┌──────────────────────┐   ┌──────────────────────────┐
│ Citizen app (Expo)   │   │ Admin dashboard (Next.js)│
│ iOS · Android        │   │ municipality staff       │
└──────────┬───────────┘   └────────────┬─────────────┘
           │  supabase-js (user JWT)    │  @supabase/ssr (cookie session)
           ▼                            ▼
┌──────────────────────────────────────────────────────┐
│ Supabase                                             │
│  Auth · Postgres (+PostGIS) · RLS · Storage · Realtime│
│  Edge Functions (push, AI, integrations — later)     │
└──────────────────────────────────────────────────────┘
           ▲
           │ shared types · Zod schemas · business rules · i18n
┌──────────┴───────────┐
│ packages/shared      │
└──────────────────────┘
```

## Repository layout

| Path              | Purpose                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`     | Citizen app. Expo SDK 58, React Native 0.88, Expo Router (file-based routes in `src/app`).                                                         |
| `apps/admin`      | Municipality dashboard. Next.js 16 App Router, Tailwind CSS 4, Cache Components.                                                                   |
| `packages/api`    | `@smart-city/api`: generated database types, typed data-access functions and `ApiError`. Takes the app's Supabase client as an argument; no React. |
| `packages/shared` | Framework-agnostic TypeScript: domain constants, Zod schemas, status workflow, design tokens, translations. No React, no Supabase.                 |
| `packages/config` | Shared TypeScript base config and ESLint base config.                                                                                              |
| `supabase`        | Migrations, RLS/storage policies, seed data, Edge Functions — the backend as code.                                                                 |
| `docs`            | Architecture, roadmap, decision log.                                                                                                               |

Workspace packages ship **TypeScript source** (no build step). Metro compiles them for
mobile; Next compiles them via `transpilePackages`. This keeps the inner loop instant and
avoids stale `dist/` folders.

## Key technical decisions

See [decisions.md](./decisions.md) for the full log with trade-offs. In short:

1. **pnpm workspaces, no Turborepo yet.** Three packages don't need a task orchestrator;
   add Turborepo when CI time matters.
2. **Isolated pnpm installs** (pnpm default). Supported by Expo since SDK 54; avoids phantom
   dependencies. Fallback is `nodeLinker: hoisted` if a native library misbehaves.
3. **One React version** (19.3.0) everywhere, pinned to what Expo SDK 58 requires.
4. **TypeScript 6.0**, not 7: `typescript-eslint` doesn't support TS 7 yet.
   **ESLint 9**, not 10: `eslint-plugin-react`/`-import` (used by `eslint-config-next`) don't support 10 yet.
5. **The database is the security boundary.** Apps use only the publishable key and the
   user's JWT; RLS decides what each user can read/write. The secret key is server-only.
6. **Dependency-free i18n** in `packages/shared` with compile-time key checking. Hebrew is
   the default locale; Hebrew and Arabic are RTL. Revisit (e.g. i18next) only if we need
   ICU plurals/formatting beyond `Intl`.
7. **Map provider behind an interface**, selected by `*_MAP_PROVIDER` (`none` | `google` | `mapbox`).

## Multi-tenancy & authorization

**Tenant key.** Every tenant-owned row carries `municipality_id`. Tables without it
(e.g. `report_attachments`) inherit tenancy through their parent and RLS joins to it.

**Identity model (planned for Phase 2).**

- `profiles` — 1:1 with `auth.users`. Citizen-facing data: name, preferred locale, home
  municipality and neighborhood.
- `employees` — staff membership: `(user_id, municipality_id, department_id, role, is_active)`.
  A person can be staff in one municipality and a citizen anywhere.
- `platform_admins` — our own operators, kept separate from municipal roles.

**RLS helpers.** Small `STABLE SECURITY DEFINER` SQL functions with a pinned `search_path`,
e.g. `app.is_staff(municipality_id)`, `app.has_role(municipality_id, role)`. Policies call
these instead of repeating joins, which keeps policies readable and fast (wrapped in
`(select …)` so Postgres evaluates them once per query).

**Rules enforced in the database, not the apps:**

- Staff only ever see rows where `municipality_id` matches an active `employees` row.
- Citizens see their own reports in full; other citizens' reports only through a
  `public_reports` view that omits reporter identity and exact free-text if flagged.
- **Status changes go through one RPC** (`update_report_status`) that validates the
  transition graph (mirrors `REPORT_STATUS_TRANSITIONS` in `packages/shared`) and the caller's
  role, then writes `report_status_history` and `audit_logs` atomically. Direct `UPDATE` of the
  `status` column is revoked. A report can never be marked resolved without an authorized
  staff action.
- Internal comments (`report_comments.is_internal = true`) are invisible to citizens.
- `audit_logs` is append-only (no UPDATE/DELETE grants), written by triggers.

**Storage.** Private bucket `report-photos` with object paths
`{municipality_id}/{report_id}/{uuid}.jpg`; storage policies parse the path and reuse the
same RLS helpers. Clients receive short-lived signed URLs. Public content (announcement and
event images) lives in a separate public bucket. File type and size are validated client-side
(`reportPhotoSchema`) **and** by bucket limits.

## Data model (draft — finalized in the first Phase 2 migration)

Conventions: `uuid` PKs (`gen_random_uuid()`), `created_at`/`updated_at timestamptz` with an
`updated_at` trigger, FKs with explicit `ON DELETE` behavior, Postgres enums mirroring the
constants in `packages/shared`, indexes on every FK and on common filters
(`municipality_id, status, created_at`).

| Table                           | Notes                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `municipalities`                | `code` (2–5 letters, used in tracking numbers), name per locale, settings JSON                                                                                                    |
| `neighborhoods`                 | `municipality_id`, localized names, PostGIS `boundary` polygon                                                                                                                    |
| `profiles`                      | see above                                                                                                                                                                         |
| `departments`                   | per municipality; default category routing                                                                                                                                        |
| `employees`                     | see above                                                                                                                                                                         |
| `report_categories`             | global defaults + per-municipality overrides (enable/disable, routing)                                                                                                            |
| `reports`                       | `tracking_number` (unique, generated by trigger from a per-municipality counter), `location geography(Point)` + GIST index, status, priority, assignee, department, `resolved_at` |
| `report_attachments`            | storage path, kind (`citizen` / `completion`), uploader                                                                                                                           |
| `report_comments`               | `is_internal`                                                                                                                                                                     |
| `report_status_history`         | from/to status, actor, note — append-only                                                                                                                                         |
| `report_confirmations`          | one per (report, user) — "I see this too"                                                                                                                                         |
| `report_followers`              | one per (report, user) — drives notifications                                                                                                                                     |
| `announcements`                 | scope: municipality or neighborhood; severity (`info` … `emergency`)                                                                                                              |
| `events`                        | schedule, location, capacity, registration                                                                                                                                        |
| `public_facilities`             | type (park, parking, toilet, library, recycling…), PostGIS point                                                                                                                  |
| `waste_collection_schedules`    | per neighborhood, recurrence rule, waste type                                                                                                                                     |
| `road_closures`                 | time window, geometry — used by transport and map                                                                                                                                 |
| `notifications` / `push_tokens` | in-app inbox + Expo push tokens per device                                                                                                                                        |
| `municipal_services`            | catalog of services/applications (Phase 3+)                                                                                                                                       |
| `audit_logs`                    | actor, action, entity, before/after JSON — append-only                                                                                                                            |

**Location** uses PostGIS: nearby reports, neighborhood auto-detection
(`ST_Contains(boundary, point)`) and duplicate detection are all spatial queries.

## Notifications

Status changes insert rows into `notifications` (in the same transaction as the status
update). An Edge Function, triggered by a database webhook/queue, delivers push messages via
the Expo Push Service. In-app inbox reads from the same table, so push is best-effort while
the inbox is the source of truth.

## AI City Assistant (design only — Phase 4)

The assistant is an **optional layer** on top of the platform; nothing in the core depends on it.

- **Runs server-side** in Edge Functions; LLM provider keys never reach clients.
- **Grounded answers only:** municipal content (services, announcements, FAQs) is embedded
  into `pgvector` per municipality; answers cite sources and refuse when nothing verified
  is found. RLS applies to retrieval, so tenants never leak into each other.
- **Tools, not free text:** the assistant calls the same RPCs a user could (create draft
  report, look up status, find facilities), so it inherits the user's permissions.
- **Suggestions, never decisions:** auto-category, priority and duplicate detection are
  stored as suggestions for staff to accept. Duplicate detection starts **non-AI** in Phase 2
  (same category + within N meters + open status, via PostGIS) and later adds embeddings.
- **Cost control:** per-municipality quotas, caching, cheap models for classification,
  stronger models only for conversation.

## Internationalization & RTL

- Locales: `he` (default), `ar`, `en`. Messages live in `packages/shared/src/i18n`; English
  defines the shape, and TypeScript fails the build if another locale is missing a key.
- Mobile: locale from device preferences (`expo-localization`); native RTL support enabled
  via the `expo-localization` config plugin. Text uses `writingDirection: 'auto'`.
- Admin: `<html lang dir>` set from the locale; layouts use logical Tailwind utilities
  (`ms-`, `pe-`, `border-e`, `start-`) so they mirror automatically.
- One font family (Rubik) covers Hebrew, Arabic and Latin on the web.

## Environments & secrets

| Variable                                        | Where              | Secret?                       |
| ----------------------------------------------- | ------------------ | ----------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` | mobile `.env`      | No — public, protected by RLS |
| `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` | admin `.env.local` | No — public, protected by RLS |
| `SUPABASE_SECRET_KEY`                           | admin server only  | **Yes** — bypasses RLS        |

Both apps validate their env with Zod at startup and run in an explicit "not configured"
preview mode instead of failing silently or pretending to be connected.
