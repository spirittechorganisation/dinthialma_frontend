/**
 * FR31 — Rotation des refresh tokens : un jeton ne sert qu'une fois (le rejouer ferme la session).
 * Un seul renouvellement à la fois entre les onglets (navigator.locks), jeton relu dans le verrou,
 * nouveau couple enregistré avant de rejouer, réseau coupé pendant le renouvellement sans déconnexion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, delay, HttpResponse } from 'msw'
import type { AxiosInstance } from 'axios'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { connecter, creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { getRefreshToken, setTokens } from '@/lib/tokenStorage'

let api: AxiosInstance
let refreshs: { refreshToken: string }[]
let redirections: number

/** Verrou exclusif, partagé comme entre deux onglets ; `avant` simule ce qu'un autre onglet fait pendant l'attente */
function verrouPartage(avant?: () => void) {
  let file: Promise<unknown> = Promise.resolve()
  return {
    request: <T>(_nom: string, tache: () => Promise<T>) => {
      const p = file.then(() => { avant?.(); return tache() })
      file = p.catch(() => undefined)
      return p
    },
  }
}

function installerVerrous(v: unknown) {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: v })
}

beforeEach(async () => {
  vi.resetModules()
  api = (await import('./api')).default
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
  installerVerrous(undefined)
  Object.defineProperty(window.location, 'href', { configurable: true, writable: true, value: 'http://localhost/' })
})

/** Ressource protégée : 200 seulement avec le jeton attendu */
function protegee(jeton: () => string) {
  server.use(http.get(`${API}/v1/me`, ({ request }) => (
    request.headers.get('Authorization') === `Bearer ${jeton()}` ? ok({ id: 'moi' }) : erreur(401, 'UNAUTHORIZED', 'Jeton expiré')
  )))
}

describe('FR31 api — rotation des refresh tokens', () => {
  it('le nouveau refresh token remplace l’ancien avant de rejouer la requête', async () => {
    connecter([UserRole.MEMBER], { expiresIn: -60 })
    const nouveau = creerJwt([UserRole.MEMBER])
    installerVerrous(verrouPartage())
    server.use(http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
      refreshs.push((await request.json()) as { refreshToken: string })
      return ok({ access_token: nouveau, refresh_token: 'refresh-2' })
    }))
    let refreshAuMomentDuRejeu: string | null = null
    server.use(http.get(`${API}/v1/me`, ({ request }) => {
      if (request.headers.get('Authorization') !== `Bearer ${nouveau}`) return erreur(401, 'UNAUTHORIZED', 'Jeton expiré')
      refreshAuMomentDuRejeu = getRefreshToken()
      return ok({ id: 'moi' })
    }))

    await expect(api.get('/v1/me')).resolves.toBeDefined()

    expect(refreshs).toEqual([{ refreshToken: 'refresh-test' }])
    expect(refreshAuMomentDuRejeu).toBe('refresh-2')
  })

  it('deux onglets : l’autre onglet a renouvelé pendant l’attente du verrou → aucun refresh, ses jetons sont repris', async () => {
    connecter([UserRole.MEMBER], { expiresIn: -60 })
    const jetonAutreOnglet = creerJwt([UserRole.MEMBER])
    // Pendant que cet onglet attend le verrou, l'autre onglet renouvelle et enregistre son couple
    installerVerrous(verrouPartage(() => setTokens(jetonAutreOnglet, 'refresh-autre-onglet')))
    server.use(http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
      refreshs.push((await request.json()) as { refreshToken: string })
      return ok({ access_token: 'ne-doit-pas-servir', refresh_token: 'ne-doit-pas-servir' })
    }))
    protegee(() => jetonAutreOnglet)

    await expect(api.get('/v1/me')).resolves.toMatchObject({ data: { data: { id: 'moi' } } })

    // Pas de rejeu de l'ancien jeton « refresh-test » (il aurait fermé la session)
    expect(refreshs).toHaveLength(0)
    expect(getRefreshToken()).toBe('refresh-autre-onglet')
  })

  it('deux renouvellements à la suite : le second part du jeton laissé par le premier, jamais de l’ancien', async () => {
    connecter([UserRole.MEMBER], { expiresIn: -60 })
    installerVerrous(verrouPartage())
    let n = 0
    server.use(http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
      refreshs.push((await request.json()) as { refreshToken: string })
      n++
      // Jeton d'accès déjà expiré : chaque requête suivante force un nouveau renouvellement
      return ok({ access_token: creerJwt([UserRole.MEMBER], { expiresIn: -1 }), refresh_token: `refresh-${n + 1}` })
    }))
    server.use(http.get(`${API}/v1/me`, () => erreur(401, 'UNAUTHORIZED', 'Jeton expiré')))

    await api.get('/v1/me').catch(() => undefined)
    window.location.href = 'http://localhost/'
    await api.get('/v1/me').catch(() => undefined)

    expect(refreshs.map((r) => r.refreshToken)).toEqual(['refresh-test', 'refresh-2'])
  })

  it('réseau coupé pendant le renouvellement : pas de déconnexion, jetons gardés, requête en échec', async () => {
    connecter([UserRole.MEMBER], { expiresIn: -60 })
    installerVerrous(verrouPartage())
    server.use(http.post(`${API}/v1/auth/refresh`, () => HttpResponse.error()))
    protegee(() => 'inutile')

    await expect(api.get('/v1/me')).rejects.toBeDefined()

    expect(redirections).toBe(0)
    expect(getRefreshToken()).toBe('refresh-test')
  })

  it('401 métier (mot de passe faux à la création du PIN) : ni renouvellement ni déconnexion', async () => {
    connecter([UserRole.MEMBER])
    installerVerrous(verrouPartage())
    server.use(
      http.post(`${API}/v1/auth/refresh`, async ({ request }) => { refreshs.push((await request.json()) as { refreshToken: string }); return erreur(401, 'SESSION_EXPIRED', 'x') }),
      http.post(`${API}/v1/auth/pin/setup`, () => erreur(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects')),
    )

    await expect(api.post('/v1/auth/pin/setup', { pin: '482913' })).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshs).toHaveLength(0)
    expect(redirections).toBe(0)
    expect(getRefreshToken()).toBe('refresh-test')
  })

  it('refresh refusé (session fermée) : une seule redirection vers /login', async () => {
    connecter([UserRole.MEMBER], { expiresIn: -60 })
    installerVerrous(verrouPartage())
    server.use(http.post(`${API}/v1/auth/refresh`, async () => { await delay(10); return erreur(401, 'SESSION_EXPIRED', 'Session expirée') }))
    protegee(() => 'inutile')

    await Promise.allSettled([api.get('/v1/me'), api.get('/v1/me')])

    expect(redirections).toBe(1)
    expect(getRefreshToken()).toBeNull()
  })
})
