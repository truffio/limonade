import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    // The simulation core must stay pure (ARCHITECTURE.md §1, §3).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/ui/**', '**/scene/**', '**/i18n/**', 'three', 'three/**'],
              message: 'core/ must stay pure: no DOM, no three.js, no UI or text.',
            },
          ],
        },
      ],
    },
  },
);
