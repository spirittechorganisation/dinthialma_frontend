/**
 * FR26 — Session perdue au rechargement.
 *
 * Cause : le jeton d'accès Keycloak dure 5 minutes (accessTokenLifespan = 300 s). Au chargement d'une page
 * protégée, ProtectedRoute envoyait sur /login dès que ce jeton était expiré, sans essayer le refresh token
 * (valable 30 minutes d'inactivité). Désormais la session est renouvelée avant d'afficher la page.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http, delay } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { storeSession, getAccessToken, getRefreshToken, clearAccessToken, verrouillerSession } from '@/lib/tokenStorage'
import { consommerRetour } from '@/lib/retour'
import api from '@/services/api'
import { ProtectedRoute } from './ProtectedRoute'

const NOUVEAU = creerJwt([UserRole.ADMIN, UserRole.MEMBER], { firstName: 'Moussa' })
let refreshs: unknown[]

function refresh(reponse: 'ok' | 'refus') {
  server.use(http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
    refreshs.push(await request.json())
    await delay(30)
    return reponse === 'ok'
      ? ok({ access_token: NOUVEAU, refresh_token: 'refresh-nouveau', expires_in: 300 })
      : erreur(401, 'UNAUTHORIZED', 'Session expirée')
  }))
}

/** Session ouverte il y a plus de 5 minutes : jeton d'accès expiré, refresh token présent */
function sessionDe6Minutes() {
  storeSession(creerJwt([UserRole.ADMIN, UserRole.MEMBER], { expiresIn: -60 }), 'refresh-test', '+221770000001')
}

function afficher() {
  return renderWithProviders(
    <Routes>
      <Route path="/encaisser/:id" element={<ProtectedRoute><p>Encaisser</p></ProtectedRoute>} />
      <Route path="/login" element={<p>Connexion</p>} />
    </Routes>,
    { route: '/encaisser/t1?membre=m1', auth: null },
  )
}

beforeEach(() => {
  refreshs = []
  consommerRetour()
})

describe('FR26 ProtectedRoute — rechargement d\'une page protégée', () => {
  it('jeton d\'accès expiré, refresh token valable : renouvelle la session et affiche la page', async () => {
    sessionDe6Minutes()
    refresh('ok')
    afficher()

    expect(await screen.findByText('Encaisser')).toBeInTheDocument()
    expect(screen.queryByText('Connexion')).not.toBeInTheDocument()
    expect(refreshs).toEqual([{ refreshToken: 'refresh-test' }])
    expect(getAccessToken()).toBe(NOUVEAU)
    expect(getRefreshToken()).toBe('refresh-nouveau')
  })

  it('refresh refusé (session Keycloak expirée) : une seule demande, puis /login proprement', async () => {
    sessionDe6Minutes()
    refresh('refus')
    afficher()

    expect(await screen.findByText('Connexion')).toBeInTheDocument()
    expect(refreshs).toHaveLength(1)
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    // La page demandée est rouverte après la connexion
    expect(consommerRetour()).toBe('/encaisser/t1?membre=m1')
  })

  it('après une déconnexion douce : pas de renouvellement, la connexion est demandée', async () => {
    sessionDe6Minutes()
    clearAccessToken()
    verrouillerSession()
    refresh('ok')
    afficher()

    expect(await screen.findByText('Connexion')).toBeInTheDocument()
    expect(refreshs).toHaveLength(0)
  })

  it('jeton d\'accès valable : page affichée sans refresh', async () => {
    storeSession(creerJwt([UserRole.MEMBER]), 'refresh-test', '+221770000001')
    refresh('ok')
    afficher()

    expect(await screen.findByText('Encaisser')).toBeInTheDocument()
    expect(refreshs).toHaveLength(0)
  })

  it('renouvellement au démarrage et 401 simultané d\'une requête : un seul refresh, la requête est rejouée', async () => {
    sessionDe6Minutes()
    refresh('ok')
    server.use(http.get(`${API}/v1/me`, ({ request }) => (
      request.headers.get('Authorization') === `Bearer ${NOUVEAU}` ? ok({ id: 'moi' }) : erreur(401, 'UNAUTHORIZED', 'Jeton expiré')
    )))

    afficher()
    const requete = api.get('/v1/me')

    expect(await screen.findByText('Encaisser')).toBeInTheDocument()
    await expect(requete).resolves.toMatchObject({ data: { data: { id: 'moi' } } })
    expect(refreshs).toHaveLength(1)
  })
})
