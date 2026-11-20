/**
 * Tests du client HTTP src/services/api.ts (spec 01, tâche 3.1)
 *
 * Couvre : injection du jeton Bearer, refresh automatique sur 401 (un seul refresh pour des
 * requêtes simultanées, requête rejouée), échec du refresh (session effacée + /login), routes
 * d'authentification exclues du refresh, 403 sans déconnexion, sérialisation des tableaux.
 *
 * `api.ts` garde un état de module (`isRefreshing`, file d'attente) : chaque test importe un
 * module neuf (`vi.resetModules()`) pour qu'un test ne puisse pas influencer le suivant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import type { AxiosInstance } from 'axios'
import { API, ok, erreur } from '../test/msw/api'
import { server } from '../test/msw/server'
import { connecter } from '../test/auth'
import { getAccessToken, getRefreshToken, getPinConfigured, getUserPhone } from '@/lib/tokenStorage'

const NOUVEAU_JETON = 'jeton-rafraichi'
const NOUVEAU_REFRESH = 'refresh-rafraichi'

let api: AxiosInstance
/** Corps reçus par /v1/auth/refresh, dans l'ordre */
let refreshs: unknown[]

beforeEach(async () => {
  vi.resetModules()
  api = (await import('./api')).default
  refreshs = []
  window.location.href = 'http://localhost/'
})

/** Refresh qui réussit (après un court délai, pour que les autres 401 arrivent pendant le refresh) */
function refreshReussi() {
  server.use(
    http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
      refreshs.push(await request.json())
      await delay(30)
      return ok({ access_token: NOUVEAU_JETON, refresh_token: NOUVEAU_REFRESH, expires_in: 3600 })
    }),
  )
}

/** Refresh qui échoue (jeton de rafraîchissement expiré) */
function refreshEnEchec() {
  server.use(
    http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
      refreshs.push(await request.json())
      await delay(30)
      return erreur(401, 'UNAUTHORIZED', 'Session expirée')
    }),
  )
}

/**
 * Ressource protégée : 401 tant que la requête ne porte pas le nouveau jeton.
 * Renvoie la liste des en-têtes Authorization reçus.
 */
function ressourceProtegee(chemin: string, donnees: unknown = { id: 'r1' }) {
  const recus: (string | null)[] = []
  server.use(
    http.all(`${API}${chemin}`, ({ request }) => {
      const auth = request.headers.get('Authorization')
      recus.push(auth)
      return auth === `Bearer ${NOUVEAU_JETON}` ? ok(donnees) : erreur(401, 'UNAUTHORIZED', 'Jeton expiré')
    }),
  )
  return recus
}

/** Indique si une promesse est toujours en attente après `ms` millisecondes (temps réel) */
async function toujoursEnAttente(p: Promise<unknown>, ms = 300): Promise<boolean> {
  const EN_ATTENTE = Symbol('en attente')
  const r = await Promise.race([p.then(() => 'résolue', () => 'rejetée'), new Promise((res) => setTimeout(() => res(EN_ATTENTE), ms))])
  return r === EN_ATTENTE
}

describe('api – configuration', () => {
  it('cible VITE_API_URL suivi du préfixe /api et envoie du JSON', () => {
    expect(api.defaults.baseURL).toBe('http://api.test/api')
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})

describe('api – jeton Bearer', () => {
  it('ajoute Authorization: Bearer <jeton> quand un jeton existe', async () => {
    const token = connecter()
    let recu: string | null = null
    server.use(http.get(`${API}/v1/me`, ({ request }) => { recu = request.headers.get('Authorization'); return ok({}) }))

    await api.get('/v1/me')

    expect(recu).toBe(`Bearer ${token}`)
  })

  it('n\'ajoute aucun en-tête Authorization quand aucun jeton n\'existe', async () => {
    let recu: string | null = 'non lu'
    server.use(http.get(`${API}/v1/public/config`, ({ request }) => { recu = request.headers.get('Authorization'); return ok({}) }))

    await api.get('/v1/public/config')

    expect(recu).toBeNull()
  })

  it('lit le jeton à chaque requête (un jeton changé entre deux appels est pris en compte)', async () => {
    connecter()
    const recus: (string | null)[] = []
    server.use(http.get(`${API}/v1/me`, ({ request }) => { recus.push(request.headers.get('Authorization')); return ok({}) }))

    await api.get('/v1/me')
    localStorage.setItem('dinthialma_access_token', 'autre-jeton')
    await api.get('/v1/me')

    expect(recus[1]).toBe('Bearer autre-jeton')
  })
})

describe('api – refresh automatique sur 401', () => {
  it('fait un seul refresh puis rejoue la requête avec le nouveau jeton', async () => {
    const ancien = connecter()
    refreshReussi()
    const recus = ressourceProtegee('/v1/tontines')

    const res = await api.get('/v1/tontines')

    expect(res.data.data).toEqual({ id: 'r1' })
    expect(refreshs).toEqual([{ refreshToken: 'refresh-test' }])
    expect(recus).toEqual([`Bearer ${ancien}`, `Bearer ${NOUVEAU_JETON}`])
  })

  it('enregistre les nouveaux jetons après le refresh', async () => {
    connecter()
    refreshReussi()
    ressourceProtegee('/v1/tontines')

    await api.get('/v1/tontines')

    expect(getAccessToken()).toBe(NOUVEAU_JETON)
    expect(getRefreshToken()).toBe(NOUVEAU_REFRESH)
  })

  it('rejoue une écriture avec la même méthode, la même URL et le même corps', async () => {
    connecter()
    refreshReussi()
    const corps: unknown[] = []
    const methodes: string[] = []
    server.use(
      http.post(`${API}/v1/cotisations`, async ({ request }) => {
        methodes.push(request.method)
        corps.push(await request.json())
        return request.headers.get('Authorization') === `Bearer ${NOUVEAU_JETON}`
          ? ok({ id: 'cot-1' })
          : erreur(401, 'UNAUTHORIZED', 'Jeton expiré')
      }),
    )

    const res = await api.post('/v1/cotisations', { tontineId: 't1', montant: 5000 })

    expect(res.data.data).toEqual({ id: 'cot-1' })
    expect(methodes).toEqual(['POST', 'POST'])
    expect(corps).toEqual([{ tontineId: 't1', montant: 5000 }, { tontineId: 't1', montant: 5000 }])
  })

  it('trois requêtes en 401 simultanées : un seul refresh, les trois sont rejouées', async () => {
    connecter()
    refreshReussi()
    const recusTontines = ressourceProtegee('/v1/tontines', ['t1'])
    const recusMe = ressourceProtegee('/v1/me', { prenom: 'Awa' })
    const recusNotifs = ressourceProtegee('/v1/notifications', [])

    const [a, b, c] = await Promise.all([api.get('/v1/tontines'), api.get('/v1/me'), api.get('/v1/notifications')])

    expect(refreshs).toHaveLength(1)
    expect([a.data.data, b.data.data, c.data.data]).toEqual([['t1'], { prenom: 'Awa' }, []])
    for (const recus of [recusTontines, recusMe, recusNotifs]) {
      expect(recus).toHaveLength(2)
      expect(recus[1]).toBe(`Bearer ${NOUVEAU_JETON}`)
    }
  })

  it('ne refait pas de refresh si la requête rejouée reçoit encore un 401', async () => {
    connecter()
    refreshReussi()
    let appels = 0
    server.use(http.get(`${API}/v1/tontines`, () => { appels++; return erreur(401, 'UNAUTHORIZED', 'Toujours refusé') }))

    await expect(api.get('/v1/tontines')).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshs).toHaveLength(1)
    expect(appels).toBe(2)
    // Jetons rafraîchis conservés, pas de redirection
    expect(getAccessToken()).toBe(NOUVEAU_JETON)
    expect(window.location.href).toBe('http://localhost/')
  })
})

describe('api – échec du refresh', () => {
  it('refresh en échec : efface la session, redirige vers /login et rejette la requête', async () => {
    connecter()
    refreshEnEchec()
    ressourceProtegee('/v1/tontines')

    await expect(api.get('/v1/tontines')).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshs).toHaveLength(1)
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('refresh en échec : toutes les requêtes en attente sont rejetées, avec un seul refresh', async () => {
    connecter()
    refreshEnEchec()
    ressourceProtegee('/v1/tontines')
    ressourceProtegee('/v1/me')
    ressourceProtegee('/v1/notifications')

    const resultats = await Promise.allSettled([api.get('/v1/tontines'), api.get('/v1/me'), api.get('/v1/notifications')])

    expect(resultats.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
    expect(refreshs).toHaveLength(1)
    expect(window.location.href).toBe('/login')
  })

  it('refresh en échec : clearAll() efface aussi le téléphone et l\'indicateur de PIN', async () => {
    connecter()
    refreshEnEchec()
    ressourceProtegee('/v1/tontines')

    await expect(api.get('/v1/tontines')).rejects.toBeDefined()

    expect(getUserPhone()).toBeNull()
    expect(getPinConfigured()).toBeNull()
  })

  it('sans refresh token : efface la session et redirige vers /login sans appeler /refresh', async () => {
    localStorage.setItem('dinthialma_access_token', 'jeton-sans-refresh')
    refreshReussi()
    ressourceProtegee('/v1/tontines')

    await expect(api.get('/v1/tontines')).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshs).toHaveLength(0)
    expect(getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('sans refresh token : un 401 suivant reste bloqué indéfiniment (tant que la page n\'est pas rechargée)', async () => {
    // BUG: quand il n'y a pas de refresh token, `isRefreshing` passe à true puis le code sort
    // (return) AVANT le bloc try/finally qui le remet à false. Tout 401 suivant est mis en file
    // d'attente et ne se termine jamais. Attendu : isRefreshing remis à false (ou le contrôle du
    // refresh token fait avant de le passer à true).
    // Gravité : latente. La redirection `window.location.href = '/login'` recharge la page dans un
    // navigateur, ce qui réinitialise le module ; le blocage ne touche que les 401 qui arrivent
    // avant ce rechargement, ou tout environnement où la redirection ne recharge pas la page.
    localStorage.setItem('dinthialma_access_token', 'jeton-sans-refresh')
    ressourceProtegee('/v1/tontines')
    await expect(api.get('/v1/tontines')).rejects.toBeDefined()
    expect(window.location.href).toBe('/login')

    // Sans rechargement du module : l'adresse redevient absolue (jsdom en a besoin pour
    // résoudre les URL), l'utilisateur a de nouveaux jetons et un 401 survient de nouveau
    window.location.href = 'http://localhost/'
    connecter()
    refreshReussi()
    const suivante = api.get('/v1/tontines')

    expect(await toujoursEnAttente(suivante)).toBe(true)
    expect(refreshs).toHaveLength(0)
  })
})

describe('api – routes exclues du refresh', () => {
  it.each(['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh', '/v1/auth/logout'])(
    '%s : un 401 est rejeté tel quel, sans refresh ni redirection',
    async (route) => {
      const token = connecter()
      let appelsRoute = 0
      let appelsRefresh = 0
      if (route !== '/v1/auth/refresh') {
        server.use(http.post(`${API}/v1/auth/refresh`, () => {
          appelsRefresh++
          return ok({ access_token: NOUVEAU_JETON, refresh_token: NOUVEAU_REFRESH })
        }))
      }
      server.use(http.post(`${API}${route}`, () => {
        appelsRoute++
        return erreur(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects')
      }))

      await expect(api.post(route, { telephone: '+221700000001' })).rejects.toMatchObject({ response: { status: 401 } })

      // Une seule requête (pas rejouée), aucun refresh, session intacte, pas de redirection
      expect(appelsRoute).toBe(1)
      expect(appelsRefresh).toBe(0)
      expect(getAccessToken()).toBe(token)
      expect(window.location.href).toBe('http://localhost/')
    },
  )

  it('une route contenant un de ces chemins est aussi exclue (comparaison par « includes »)', async () => {
    // Comportement actuel : `url.includes('/v1/auth/login')` exclut aussi /v1/auth/login-pin.
    connecter()
    let refreshAppele = false
    server.use(
      http.post(`${API}/v1/auth/login-pin`, () => erreur(401, 'PIN_INVALIDE', 'PIN incorrect')),
      http.post(`${API}/v1/auth/refresh`, () => { refreshAppele = true; return ok({}) }),
    )

    await expect(api.post('/v1/auth/login-pin', { pin: '000000' })).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshAppele).toBe(false)
    expect(window.location.href).toBe('http://localhost/')
  })
})

describe('api – autres erreurs', () => {
  it('403 : erreur remontée, aucun refresh, aucune déconnexion', async () => {
    const token = connecter()
    refreshReussi()
    server.use(http.get(`${API}/v1/admin/users`, () => erreur(403, 'FORBIDDEN', 'Accès refusé')))

    await expect(api.get('/v1/admin/users')).rejects.toMatchObject({
      response: { status: 403, data: { code: 'FORBIDDEN', message: 'Accès refusé' } },
    })

    expect(refreshs).toHaveLength(0)
    expect(getAccessToken()).toBe(token)
    expect(window.location.href).toBe('http://localhost/')
  })

  it.each([
    [400, 'VALIDATION_ERROR'],
    [409, 'COTISATION_DEJA_DECLAREE'],
    [500, 'ERREUR_INTERNE'],
  ])('%i : erreur remontée telle quelle, sans refresh', async (status, code) => {
    connecter()
    refreshReussi()
    server.use(http.post(`${API}/v1/cotisations`, () => erreur(status, code, 'Refusé')))

    await expect(api.post('/v1/cotisations', {})).rejects.toMatchObject({ response: { status, data: { code } } })

    expect(refreshs).toHaveLength(0)
  })

  it('erreur réseau : rejetée sans refresh ni redirection', async () => {
    connecter()
    refreshReussi()
    server.use(http.get(`${API}/v1/me`, () => HttpResponse.error()))

    await expect(api.get('/v1/me')).rejects.toMatchObject({ code: 'ERR_NETWORK' })

    expect(refreshs).toHaveLength(0)
    expect(window.location.href).toBe('http://localhost/')
  })
})

describe('api – paramètres de requête', () => {
  it('sérialise les tableaux en valeurs répétées (statut=A&statut=B), sans crochets', async () => {
    connecter()
    let url = ''
    server.use(http.get(`${API}/v1/tontines`, ({ request }) => { url = request.url; return ok([]) }))

    await api.get('/v1/tontines', { params: { statut: ['ACTIVE', 'EN_ATTENTE'], page: 0 } })

    const params = new URL(url).searchParams
    expect(params.getAll('statut')).toEqual(['ACTIVE', 'EN_ATTENTE'])
    expect(params.get('page')).toBe('0')
    expect(url).not.toContain('statut%5B')
    expect(url).not.toContain('statut[')
  })

  it('omet les paramètres undefined et null', async () => {
    connecter()
    let url = ''
    server.use(http.get(`${API}/v1/tontines`, ({ request }) => { url = request.url; return ok([]) }))

    await api.get('/v1/tontines', { params: { statut: undefined, recherche: null, page: 1 } })

    expect(new URL(url).search).toBe('?page=1')
  })
})
