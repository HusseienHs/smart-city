# Supabase

Database schema, Row Level Security policies, storage policies and Edge Functions live here
as code. **The database is the security boundary** — every permission is enforced by RLS or
`SECURITY DEFINER` functions, never only by the apps.

## Layout

```
supabase/
  config.toml        # created by `supabase init` (Phase 2)
  migrations/        # timestamped SQL migrations — the only way the schema changes
  functions/         # Edge Functions (push notifications, AI, integrations) — later phases
  seed.sql           # fictional local dev data, applied by `supabase db reset`
```

## Workflow (Phase 2 onward)

Requires Docker Desktop for the local stack.

```bash
pnpm dlx supabase init            # once: creates config.toml
pnpm dlx supabase start           # local Postgres, Auth, Storage, Studio
pnpm dlx supabase migration new <name>
pnpm dlx supabase db reset        # re-apply migrations + seed locally
pnpm dlx supabase gen types typescript --local > packages/shared/src/database.types.ts
```

Rules:

- Never edit a migration that has been applied to a shared environment — add a new one.
- Every new table gets RLS enabled **in the same migration** that creates it.
- Every policy change ships with a test (pgTAP) proving cross-municipality access is denied.

See [docs/architecture.md](../docs/architecture.md) for the data model and security design.
