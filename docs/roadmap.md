# Implementation roadmap

Each phase ends with working, tested software. Each phase is a set of small PRs.

## Phase 1 — Foundation ✅

- pnpm monorepo, shared TS/ESLint/Prettier config, `.editorconfig`
- Expo citizen app: Expo Router, 5-tab navigation with prominent Report button, theme tokens, i18n (he/ar/en), RTL enabled
- Next.js admin: RTL layout, sidebar navigation for all sections, overview shell
- `@smart-city/shared`: report categories/statuses/priorities, status workflow, roles, Zod schemas, design tokens, translations — with unit tests
- Supabase client factories (mobile + admin server/browser), env validation, `.env.example` files
- Documentation

## Phase 2 — MVP (core reporting loop)

Ordered by dependency:

1. **Database foundation** — `supabase init`, first migrations: enums, municipalities,
   neighborhoods, profiles, departments, employees, RLS helper functions, `updated_at` and
   audit triggers. pgTAP tests for tenant isolation. Generated DB types into `packages/shared`.
2. **Authentication** — email/password sign-up/sign-in/recovery on mobile; staff sign-in on
   admin with session-refresh proxy and route protection; profile creation trigger.
3. **Onboarding** — municipality + neighborhood selection, language picker (persisted, RTL reload).
4. **Reports schema** — reports, categories, attachments, comments, status history,
   confirmations, followers; tracking-number generator; `update_report_status` RPC; storage bucket + policies.
5. **Report submission (mobile)** — category → photos (camera/library, compression) → GPS
   location + map pin → description → review → submit; offline-safe draft; tracking number shown.
6. **My reports (mobile)** — history, detail with status timeline, follow/confirm.
7. **Admin report management** — TanStack Query list with filters (category, status,
   neighborhood, priority), search, detail view, assign to department/employee, status
   updates, internal comments, completion photos.
8. **Notifications** — push token registration, in-app inbox, Edge Function delivering status-change pushes.
9. **Admin user management** — invite employees, departments, roles.
10. **Quality gates** — CI (GitHub Actions: format, lint, typecheck, tests), Sentry, EAS
    development/preview builds, staging Supabase project.

## Phase 3 — Daily use

Personalized home feed · announcements & emergency alerts (admin publishing + push) · city
map with facilities, reports, closures (map provider integration) · events with
registration and reminders · waste collection schedules and reminders · road closures and
transport info · neighborhood community (with moderation) · admin analytics v1
(volumes, response/resolution times, by category/neighborhood).

## Phase 4 — Advanced

AI City Assistant (grounded RAG + tools, see architecture) · AI categorization, priority and
duplicate suggestions · advanced analytics and employee performance · municipal service
requests and appointment booking · payment integrations · municipal system integrations
(CRM/GIS/ERP connectors) · public open-data API.
