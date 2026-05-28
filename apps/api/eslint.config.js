// ESLint Flat Config — AEGIS API
// ESLint v10+ flat config format
'use strict';

const tsparser = require('@typescript-eslint/parser');
const tsplugin = require('@typescript-eslint/eslint-plugin');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  // Base TypeScript config
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsplugin,
    },
    rules: {
      // Start with TypeScript-ESLint recommended rules
      ...tsplugin.configs.recommended.rules,
      // Custom overrides
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'error',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  // Prettier integration (must be last in config array to override other rules)
  eslintConfigPrettier,
  // Global ignores
  {
    ignores: ['dist/', 'node_modules/', '*.js', 'coverage/'],
  },
];
