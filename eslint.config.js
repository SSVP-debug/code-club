import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['backend/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/*.spec.{js,jsx}', 'src/test/**'],
    ignores: ['backend/**'],
    languageOptions: {
      // Vitest exposes Node's `global` (e.g. `global.fetch = vi.fn()`)
      // even in jsdom-environment tests — without this, every such mock
      // was a no-undef false positive, not an actual missing import.
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['e2e/**/*.js'],
    languageOptions: {
      // e2e fixtures run under Node (Playwright), not the browser — they
      // reference process.env directly, same as any other Node script.
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['backend/**', 'scripts/**'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // SECURITY (Sept 2026 architecture audit, finding D / Batch 2): src/data/problems.js
  // and src/data/code-club-edition/CCE-*.js are the hand-authored problem content
  // files — they contain every problem's `hiddentestcases` in plaintext. Importing
  // either from anywhere the frontend bundle can reach (which is everywhere under
  // src/, static or dynamic) ships the entire hidden-test dataset to every visitor,
  // regardless of which fields the importing code actually reads. This is exactly
  // how RelatedProblems.jsx's leak happened — it only needed `.title`/`.difficulty`,
  // but the whole module (including hiddentestcases) still had to be bundled.
  //
  // If you have a genuine reason to touch this data client-side (e.g. an
  // offline/API-down fallback, the pattern used in useProblems.js), that call site
  // needs its own security review — add it to the `ignores` list below alongside
  // the existing ones, with a comment explaining why it's safe, rather than
  // silencing this rule inline. Do not add a new import without that review.
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: [
      'src/hooks/useProblems.js',
      'src/components/AvatarDropdown.jsx',
      'src/config/roleCommands.js',
      'src/utils/dailyChallenge.js',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/data/problems.js', '**/data/problems', '**/data/code-club-edition/*'],
            message:
              'This file contains every problem\'s hiddentestcases in plaintext. Importing it from frontend-reachable code ships the full hidden-test dataset to every visitor (Sept 2026 architecture audit, finding D). If this is a reviewed, necessary exception (e.g. an offline fallback), add this file to the ignores list in eslint.config.js instead of bypassing this rule.',
          },
        ],
      }],
    },
  },
])
