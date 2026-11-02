// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const { prettier, sharedRules } = require('@smart-city/config/eslint/base');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'expo-env.d.ts', 'ios/*', 'android/*'],
  },
  { files: ['**/*.{ts,tsx}'], rules: sharedRules },
  prettier,
]);
