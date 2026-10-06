import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
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
  // Known chart hook lint debt is temporarily warnings only; see docs/lint-debt.md.
  {
    files: [
      'src/components/charts/highlight-segment.jsx',
      'src/components/charts/tooltip/chart-tooltip.jsx',
      'src/components/charts/tooltip/date-ticker.jsx',
      'src/components/charts/tooltip/tooltip-box.jsx',
      'src/components/charts/use-animated-y-domains.js',
      'src/components/charts/use-chart-phase-orchestrator.js',
      'src/components/charts/use-highlight-segment.js',
      'src/components/charts/use-mount-progress.js',
    ],
    rules: {
      'react-hooks/refs': 'warn',
    },
  },
  {
    files: [
      'src/components/charts/tooltip/chart-tooltip.jsx',
      'src/components/charts/tooltip/tooltip-box.jsx',
      'src/components/charts/use-animated-series-path.js',
      'src/components/charts/use-chart-phase-orchestrator.js',
      'src/components/charts/use-enter-complete.js',
      'src/context/WorkoutsContext.jsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/components/charts/y-axis.jsx'],
    rules: {
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
])
