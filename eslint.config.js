import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Lint for real bugs, not style. JS recommended + React hooks rules; stylistic noise is off so
// `npm run lint` stays a signal, not a chore.
export default [
  { ignores: ['dist/**', 'public/pyodide-scripts/**', 'node_modules/**', '.vercel/**'] },

  // App source — browser globals, JSX, hooks.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules, // React 19 / new JSX transform — no React import needed
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Unused vars are real signal, but allow intentionally-ignored args/elements (e.g. `_`, caught errors).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'react/prop-types': 'off', // no PropTypes in this codebase
      'react/no-unescaped-entities': 'off', // apostrophes in copy render fine — pure noise
      // react-hooks v7's React-Compiler-era rules flag intentional, working patterns here
      // (ref-mirroring for the Pyodide poller, effects calling functions defined below, loading
      // setState). Keep rules-of-hooks + exhaustive-deps; drop the compiler-only checks.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },

  // Web Worker — worker globals (self, postMessage, importScripts).
  {
    files: ['src/lib/pyodide/worker.js'],
    languageOptions: { globals: { ...globals.worker } },
  },

  // Tooling / config / scripts — Node globals.
  {
    files: ['*.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { ...js.configs.recommended.rules },
  },

  // Vitest unit tests — browser + vitest globals (config sets `globals: true`).
  {
    files: ['tests/**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, vi: 'readonly', describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly', beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-vars': 'error', // count components used in JSX as "used" (no false unused-import errors)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
]
