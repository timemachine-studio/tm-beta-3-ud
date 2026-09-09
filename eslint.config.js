import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh.plugin,
    },
    rules: {
      // Keep the complete forward-looking Hooks policy explicit. Hooks 7.1.1
      // adds void-use-memo beyond the stable preset, and future supported
      // Compiler diagnostics will be adopted on plugin upgrades.
      ...reactHooks.configs.flat['recommended-latest'].rules,
      // A missing dependency is how handleSendMessage captured a stale
      // currentSessionId and saved completions into the previously-open chat.
      // Once storage is local-only (Gate LS) there is no cloud copy to recover
      // from, so this is a data-loss class of bug, not a style nit
      // (production-check.md 1.13).
      'react-hooks/exhaustive-deps': 'error',
      // Match TypeScript's own convention: a leading underscore means
      // "deliberately unused", so the two checkers agree.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  }
);
