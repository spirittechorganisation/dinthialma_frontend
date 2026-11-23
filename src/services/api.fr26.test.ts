/**
 * FR26 — Renouvellement des jetons partagé (services/api.ts).
 *
 * Corrige B3 (spec 01) : sans refresh token, `isRefreshing` restait à true et tout 401 suivant attendait
 * indéfiniment. Le renouvellement est maintenant une promesse partagée par l'intercepteur, le démarrage
 * (ProtectedRoute) et useAuth.refreshSession, remise à zéro dans tous les cas.
 * Module neuf à chaque test (état de module : renouvellement en cours, redirection faite).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, delay } from 'msw'
import type { AxiosInstance } from 'axios'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { connecter } from '@/test/auth'

const NOUVEAU_JETON = 'jeton-fr26'

let api: AxiosInstance
let mod: typeof import('./api')
let refreshs: unknown[]
/** Affectations de window.location.href à '/login' */
let redirections: number

beforeEach(async () => {
  vi.resetModules()
  mod = await import('./api')
  api = mod.default
  refreshs = []
  redirections = 0
  let href = 'http://localhost/'
  Object.defineProperty(window.location, 'href', {
    configurable: true,
    get: () => href,
    set: (v: string) => { href = v; if (v === '/login') redirections++ },
  })
})

afterEach(() => {
  Object.defineProperty(window.location, 'href', { configurable: true, writable: true, value: 'http://localhost/' })
})

function refresh(reponse: 'ok' | 'refus') {
  server.use(http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
    refreshs.push(await request.json())
    await delay(30)
    return reponse === 'ok'
      ? ok({ access_token: NOUVEAU_JETON, refresh_token: 'refresh-fr26', expires_in: 300 })
      : erreur(401, 'UNAUTHORIZED', 'Session expirée')
  }))
}

function protegee(chemin: string) {
  server.use(http.get(`${API}${chemin}`, ({ request }) => (
    request.headers.get('Authorization') === `Bearer ${NOUVEAU_JETON}` ? ok({ chemin }) : erreur(401, 'UNAUTHORIZED', 'Jeton expiré')
  )))
}

describe('FR26 api — renouvellement partagé', () => {
  it('deux appels simultanés en 401 : un seul refresh, les deux sont rejoués', async () => {
    connecter()
    refresh('ok')
    protegee('/v1/tontines')
    protegee('/v1/me')

    const [a, b] = await Promise.all([api.get('/v1/tontines'), api.get('/v1/me')])

    expect(a.data.data).toEqual({ chemin: '/v1/tontines' })
    expect(b.data.data).toEqual({ chemin: '/v1/me' })
    expect(refreshs).toHaveLength(1)
  })

  it('renouvelerJetons appelé pendant un refresh de l\'intercepteur : même requête, même jeton', async () => {
    connecter()
    refresh('ok')
    protegee('/v1/tontines')

    const requete = api.get('/v1/tontines')
    await new Promise((r) => setTimeout(r, 5))
    const jeton = await mod.renouvelerJetons()

    expect(jeton).toBe(NOUVEAU_JETON)
    await requete
    expect(refreshs).toHaveLength(1)
  })

  it('échec du refresh avec plusieurs requêtes : une seule redirection vers /login', async () => {
    connecter()
    refresh('refus')
    protegee('/v1/tontines')
    protegee('/v1/me')
    protegee('/v1/notifications')

    await Promise.allSettled([api.get('/v1/tontines'), api.get('/v1/me'), api.get('/v1/notifications')])

    expect(refreshs).toHaveLength(1)
    expect(redirections).toBe(1)
    expect(localStorage.getItem('dinthialma_refresh_token')).toBeNull()
  })

  it('B3 corrigé : sans refresh token, un 401 suivant n\'est plus bloqué', async () => {
    localStorage.setItem('dinthialma_access_token', 'jeton-sans-refresh')
    protegee('/v1/tontines')
    await expect(api.get('/v1/tontines')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshs).toHaveLength(0)

    // Sans rechargement du module : adresse de nouveau absolue (jsdom résout les URL avec),
    // de nouveaux jetons, puis un nouveau 401
    window.location.href = 'http://localhost/'
    connecter()
    refresh('ok')
    await expect(api.get('/v1/tontines')).resolves.toMatchObject({ data: { data: { chemin: '/v1/tontines' } } })
    expect(refreshs).toHaveLength(1)
  })

  it('renouvelerJetons sans refresh token : rejette SansRefreshToken, sans appel', async () => {
    await expect(mod.renouvelerJetons()).rejects.toBeInstanceOf(mod.SansRefreshToken)
    expect(refreshs).toHaveLength(0)
  })
})
