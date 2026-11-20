/// <reference types="vitest" />
// Fuseau Africa/Dakar pour tous les tests
process.env.TZ = 'Africa/Dakar'

import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      css: false,
      globals: false,
      // Parcours d'écran complets (création de tontine, validation par lots) : 5 s par défaut ne
      // suffisent pas quand toute la suite tourne en parallèle (échecs aléatoires le 19/11/2026).
      testTimeout: 20_000,
      env: {
        VITE_API_URL: 'http://api.test',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: [
          'src/test/**',
          'src/types/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
          '**/*.d.ts',
        ],
        // Seuils par dossier (spec 01, tâches 2.5, 3.3 et 5.1) : couverture des lignes.
        // lib : mesurée à 98,87 % le 19/11/2026. services (80) et hooks (70) viendront avec les lots B et I.
        thresholds: {
          'src/lib/**': { lines: 90 },
        },
      },
    },
  }),
)
