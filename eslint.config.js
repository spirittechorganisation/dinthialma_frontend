// eslint.config.js — ESLint 9 (format « flat config »)
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  // ── Fichiers ignorés ────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'coverage/**'],
  },

  // ── Base JS + TypeScript ────────────────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Configuration principale ─────────────────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React Hooks
      ...reactHooks.configs.recommended.rules,
      // React Refresh (HMR)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // TypeScript — relaxations nécessaires pour le code existant
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Autorisé dans les blocs catch vides intentionnels
      'no-empty': ['error', { allowEmptyCatch: false }],
      // setState dans useEffect : pattern courant pour les resets/accumulations sur dépendance
      'react-hooks/set-state-in-effect': 'off',
      // exhaustive-deps : génère des faux positifs sur les callbacks stables (navigate, fonctions locales)
      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // ── Fichiers de test ─────────────────────────────────────────────────────────
  {
    files: ['src/test/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Les factories retournent souvent des objets partiels
      '@typescript-eslint/no-explicit-any': 'off',
      // Le rechargement à chaud (Fast Refresh) ne concerne pas les tests : les outils partagés
      // peuvent exporter composants et fonctions ensemble (ex. src/test/router.tsx)
      'react-refresh/only-export-components': 'off',
    },
  },

  // ── Composants UI génériques (props génériques nécessitent any) ──────────────
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ── Hooks et utilitaires mixtes (exportent hooks + constantes) ──────────────
  // react-refresh s'applique seulement aux pages/composants — pas aux hooks
  {
    files: [
      'src/hooks/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/components/auth/PinPad.tsx',
      'src/components/home/ActivityFeed.tsx',
      'src/components/home/HomeSheets.tsx',
      'src/components/layout/Panneau.tsx',
      'src/components/shared/QueryError.tsx',
      'src/pages/OnboardingPage.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // ── Config Vite (environnement Node) ────────────────────────────────────────
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
      },
    },
  },
)
