import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', '.worktrees', 'public/push-sw.js', 'dev-dist'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    settings: { react: { version: 'detect' } },
    rules: { 'react/prop-types': 'off' },
  },
  {
    // Node/API tooling — not browser
    files: ['api/**/*.{js,mjs}', 'server/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/src/auth/AuthProvider.jsx', '**/src/components/HakumAuthShell.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/src/components/PPFVisualizer.jsx'],
    // React Three Fiber JSX properties describe Three.js objects, not DOM nodes.
    rules: { 'react/no-unknown-property': 'off' },
  },
  {
    files: ['**/src/components/ui/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'no-unused-vars': ['error', { varsIgnorePattern: '^React$', argsIgnorePattern: '^_' }],
    },
  },
]
