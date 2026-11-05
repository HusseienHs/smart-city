import { defineConfig } from 'vitest/config';

// Unit tests for pure logic only (no React Native runtime): keep tested code free of
// react-native / expo imports.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
