/**
 * Configuration globale Vitest — exécutée avant chaque fichier de test.
 *
 * - Active les matchers jest-dom (@testing-library/jest-dom/vitest).
 * - Gère le cycle de vie MSW (listen / resetHandlers / close).
 * - Nettoie le DOM et le stockage local entre chaque test.
 * - Simule les APIs navigateur absentes de jsdom.
 * - Simule le module virtuel vite-plugin-pwa (`virtual:pwa-register/react`).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './msw/server'

// ─── MSW ─────────────────────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ─── Nettoyage React et stockage ─────────────────────────────────────────────
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

// ─── window.matchMedia (jsdom ne l'implémente pas) ───────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ─── navigator.share ─────────────────────────────────────────────────────────
Object.defineProperty(navigator, 'share', {
  writable: true,
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

// ─── navigator.clipboard — laissé à userEvent (il le configure lui-même) ─────
// Ne pas redéfinir ici : userEvent.setup() en a besoin et lancerait
// "Cannot redefine property: clipboard" si on l'a déjà verrouillé.

// ─── IntersectionObserver ────────────────────────────────────────────────────
window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof IntersectionObserver

// ─── ResizeObserver ──────────────────────────────────────────────────────────
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver

// ─── virtual:pwa-register/react ──────────────────────────────────────────────
// usePWA importe useRegisterSW depuis ce module virtuel de vite-plugin-pwa.
// jsdom n'a pas de service worker : on simule le hook avec des valeurs neutres.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn().mockReturnValue({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

// ─── window.location.href (redirections après logout/401) ───────────────────
// L'intercepteur Axios appelle window.location.href = '/login'.
// jsdom lève une erreur sur cette assignation : on l'espionne à la place.
// Les champs d'URL doivent rester cohérents (href absolu, protocol, host…) : axios et MSW
// résolvent les URL de requête par rapport à `location` ; un href vide fait échouer
// silencieusement toute requête avec « Invalid URL ».
Object.defineProperty(window, 'location', {
  writable: true,
  configurable: true,
  value: {
    href: 'http://localhost/',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    origin: 'http://localhost',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    toString: () => 'http://localhost/',
  },
})
