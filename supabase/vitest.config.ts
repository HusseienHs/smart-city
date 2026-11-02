import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Each test file boots an in-process Postgres (PGlite + PostGIS) and applies all migrations.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
