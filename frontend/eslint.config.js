import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jsdocPlugin from 'eslint-plugin-jsdoc';

export default [
  {
    // tests/html/ is regenerated Sphinx build output (gitignored), not project code.
    ignores: ['tests/html/**'],
  },
  {
    ...jsdocPlugin.configs['flat/recommended'],
    files: ['src/**/*.ts', 'tests/**/*.ts'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      jsdoc: jsdocPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'jsdoc/no-undefined-types': 'off',
      'max-len': ['error', {ignoreRegExpLiterals: true}],
    },
  },
];
