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
        thresholds: {},
      },
    },
  }),
)
