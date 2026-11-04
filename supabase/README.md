# Supabase

Database schema, Row Level Security, storage policies and security tests, as code.
**The database is the security boundary**: every permission is enforced by RLS or by
`SECURITY DEFINER` functions, never only by the apps. Design: [docs/database-design.md](../docs/database-design.md).

## Layout

```
supabase/
  migrations/          timestamped SQL migrations — the only way the schema changes
  seed.sql             fictional demo data for the DEV project only
  tests/               security test suites (Vitest + in-process Postgres)
    support/           test harness, Supabase shim, fixtures
```

## Tests (no Docker, no network)

```bash
pnpm --filter @smart-city/supabase test      # or `pnpm test` at the root
```

Tests boot PGlite (Postgres + PostGIS compiled to WebAssembly) inside Node, apply a
test-only Supabase shim and every migration, then run each statement as a specific actor
(`anon`, a user's JWT, or the service role). Nothing touches a real database.

## Applying migrations (hosted dev project, no Docker)

Hosted development uses **synthetic data only** (D-007). Follow the checklist in
`docs/database-design.md` §9:

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <dev-project-ref>
pnpm dlx supabase db push --remote --dry-run   # CLI v3: --remote targets the linked project
pnpm dlx supabase db push --remote             # only after the dry-run is approved
pnpm dlx supabase db push --remote --include-seed   # dev project only, separate approval (§9.4)
pnpm dlx supabase gen types typescript --linked > packages/api/src/database.types.ts
```

Windows Smart App Control blocks the unsigned CLI binary on the main development machine
(D-011). There, regenerate the types through the same Management API endpoint the CLI uses:
`GET https://api.supabase.com/v1/projects/<ref>/types/typescript?included_schemas=public`,
saving the response's `types` field to the same file, or run the CLI from WSL or CI. The
generated file is never edited by hand and is excluded from Prettier and ESLint.

The local stack (`supabase start`, which needs Docker) works with the same migrations for
anyone who has Docker, and in CI.

## Rules

- Never edit a migration that has been applied to a shared environment; add a new one.
- Every new table enables RLS and revokes Supabase's default grants in the same migration.
- Every new `SECURITY DEFINER` function sets `search_path = ''`, and revokes `EXECUTE` from
  `public`/`anon` unless it's meant for them.
- Every new function in `private` must have PUBLIC's `EXECUTE` revoked; grant
  `authenticated` only if an RLS policy or check constraint calls it.
- Tables with identifying columns use column-level `SELECT` grants; never expose user ids
  of citizens to staff.
- Every policy change ships with tests. `schema-guards.test.ts` fails if a table lacks RLS,
  a grant is broader than the allowlist, or a function has a mutable `search_path`.
- Seed and test data must be obviously fictional (`example.invalid` / `example.test`
  emails, `+9720…` phone numbers, "Demo"/"Test" municipalities).
