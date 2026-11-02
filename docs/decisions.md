# Decision log

Lightweight architecture decision records. Add a new entry instead of rewriting old ones.

---

### D-001 · pnpm workspaces without a build orchestrator (2026-11-02)

**Decision:** Plain pnpm workspaces; root scripts fan out with `pnpm -r`.
**Why:** Three packages, no build step for shared code. Turborepo/Nx add config and caching
complexity we don't need yet.
**Revisit when:** CI exceeds ~5 minutes or we add more apps/packages.

### D-002 · Shared packages ship TypeScript source (2026-11-02)

**Decision:** `@smart-city/shared` exports `.ts` files directly; consumers compile it.
**Why:** No watch/build step, instant changes in both apps, no stale `dist/`.
**Trade-off:** Consumers must be able to compile TS (Metro and Next both can). If we ever
publish the package or add a Node-only consumer without a bundler, add a build step.

### D-003 · Version pins (2026-11-02)

**Decision:** Expo SDK 58 / RN 0.88 / React 19.3.0 / Next 16.4 / TypeScript ~6.0 / ESLint 9.
**Why:** React must be identical across the monorepo (Expo requirement). TypeScript 7 and
ESLint 10 are released but not yet supported by `typescript-eslint` (`<6.1`) and
`eslint-plugin-react`/`eslint-plugin-import` respectively.
**Rule:** Mobile native packages are added with `npx expo install` (SDK-compatible versions).

### D-004 · Authorization lives in Postgres (2026-11-02)

**Decision:** RLS + `SECURITY DEFINER` RPCs are the only enforcement layer that matters.
Frontends use shared helpers (e.g. `canTransitionReportStatus`) purely for UX.
**Why:** Mobile clients are untrusted; a single enforcement point can't drift between apps.

### D-005 · Dependency-free i18n (2026-11-02)

**Decision:** Typed message objects + `translate()` in `packages/shared`.
**Why:** Same strings on mobile and web, compile-time key checks, zero dependencies.
**Revisit when:** We need ICU plural/select rules beyond what `Intl.PluralRules` covers simply.

### D-006 · Mobile session storage (2026-11-02)

**Decision:** Supabase auth session persisted in AsyncStorage; client created lazily.
**Why:** SecureStore has a ~2 KB value limit, too small for Supabase sessions.
**Revisit:** Encrypt the session at rest (AES key in SecureStore, ciphertext in AsyncStorage)
before production launch.

### D-007 · Open decisions (owner input needed)

- **Hosting region / data residency** for municipal and citizen data (Supabase has no Israel region; check municipal procurement and privacy requirements).
- **Map provider:** Google Maps vs Mapbox (cost, Hebrew/Arabic labels, offline tiles).
- **App identifiers:** iOS bundle ID / Android package name — permanent after store release.
- **Repository license** and visibility.
