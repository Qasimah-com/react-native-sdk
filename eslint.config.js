const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  { ignores: ['lib/**', 'node_modules/**', 'coverage/**', 'android/**', 'ios/**', 'demo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.tsx', 'example/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['src/promo/svg.ts', 'test/riyalSymbol.test.tsx', 'test/logo.test.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['*.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
