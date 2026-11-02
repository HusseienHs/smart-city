# Smart City

An all-in-one digital platform connecting citizens with their municipalities: municipal
issue reporting, city updates, events, services and neighborhood life, in one app.

- **Citizen app** for iOS and Android (Expo / React Native)
- **Municipality dashboard** on the web (Next.js)
- **Backend** on Supabase (Postgres, Auth, Storage, Realtime, RLS)
- Multi-tenant SaaS · Hebrew (default), Arabic, English · full RTL support

> **Status:** Phase 1 (foundation). The apps run with placeholder screens; no backend is
> connected yet. See the [roadmap](docs/roadmap.md).

## Repository

```
apps/
  mobile/     Citizen app — Expo SDK 58, Expo Router
  admin/      Municipality dashboard — Next.js 16, Tailwind CSS 4
packages/
  shared/     Domain types, Zod schemas, business rules, design tokens, translations
  config/     Shared TypeScript and ESLint configuration
supabase/     Migrations, RLS policies, seed data (backend as code)
docs/         Architecture, roadmap, decision log
```

Read [docs/architecture.md](docs/architecture.md) before contributing.

## Prerequisites

- **Node.js 22.12+** (24 recommended, see `.nvmrc`)
- **pnpm 10**: `npm install -g pnpm@10` (or `corepack enable pnpm`)
- For the mobile app: the **Expo Go** app on your phone, or an Android emulator / iOS simulator
- For local Supabase (Phase 2): **Docker Desktop**

## Getting started

```bash
pnpm install

# Optional – connect a Supabase project (apps run in preview mode without it)
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example apps/admin/.env.local
```

### Mobile app

```bash
pnpm dev:mobile
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `a` / `i` to
open an emulator/simulator. Phone and computer must be on the same network (or run
`pnpm --filter @smart-city/mobile start --tunnel`).

### Admin dashboard

```bash
pnpm dev:admin
```

Open http://localhost:3000.

## Scripts

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `pnpm dev:mobile`  | Start the Expo dev server                         |
| `pnpm dev:admin`   | Start the Next.js dev server                      |
| `pnpm build:admin` | Production build of the dashboard                 |
| `pnpm lint`        | ESLint in every package                           |
| `pnpm typecheck`   | TypeScript in every package                       |
| `pnpm test`        | Unit tests (Vitest)                               |
| `pnpm format`      | Format everything with Prettier                   |
| `pnpm check`       | Format check + lint + typecheck + tests (CI gate) |

## Conventions

- **Add mobile dependencies with `npx expo install <pkg>`** (inside `apps/mobile`) so
  versions match the Expo SDK.
- **Security lives in the database.** Never rely on UI checks for authorization. Never put
  the Supabase secret key in a client app or a `NEXT_PUBLIC_` / `EXPO_PUBLIC_` variable.
- **Shared logic goes in `packages/shared`** if both apps need it and it has no UI or
  framework dependency.
- **Every user-facing string** goes through the translations in all three languages.
- **Mock data** must be clearly labeled as such. Never fake an integration.
