import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
  {
    files: ['src/server/**/*.ts', 'src/data/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/client/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
