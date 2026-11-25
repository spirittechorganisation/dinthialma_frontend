/**
 * FR31 — Page protégée sur un appareil de confiance (appareilId, PIN configuré, numéro connu) : session
 * irrécupérable → écran PIN en gardant le numéro, au lieu de /login. Sinon, inchangé (FR26).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http, delay } from 'msw'
import { API, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { storeSession, setPinConfigured, getUserPhone, getRefreshToken, clearAccessToken, verrouillerSession } from '@/lib/tokenStorage'
import { APPAREIL_KEY } from '@/lib/appareil'
import { ProtectedRoute } from './ProtectedRoute'

function afficher() {
  return renderWithProviders(
    <Routes>
      <Route path="/encaisser" element={<ProtectedRoute><p>Encaisser</p></ProtectedRoute>} />
      <Route path="/pin" element={<p>Écran PIN</p>} />
      <Route path="/login" element={<p>Connexion</p>} />
    </Routes>,
    { route: '/encaisser', auth: null },
  )
}

function appareilDeConfiance() {
  storeSession(creerJwt([UserRole.MEMBER], { expiresIn: -60 }), 'refresh-test', '+221770000001')
  setPinConfigured(true)
  localStorage.setItem(APPAREIL_KEY, 'appareil-12345678')
}

beforeEach(() => { localStorage.clear() })

describe('FR31 ProtectedRoute — appareil de confiance', () => {
  it('refresh refusé : écran PIN, numéro gardé', async () => {
    appareilDeConfiance()
    server.use(http.post(`${API}/v1/auth/refresh`, async () => { await delay(10); return erreur(401, 'SESSION_EXPIRED', 'Session expirée') }))
    afficher()

    expect(await screen.findByText('Écran PIN')).toBeInTheDocument()
    expect(getUserPhone()).toBe('221770000001')
    expect(getRefreshToken()).toBeNull()
  })

  it('après une déconnexion douce : écran PIN, pas de renouvellement', async () => {
    appareilDeConfiance()
    clearAccessToken()
    verrouillerSession()
    let refreshs = 0
    server.use(http.post(`${API}/v1/auth/refresh`, () => { refreshs++; return erreur(401, 'SESSION_EXPIRED', 'x') }))
    afficher()

    expect(await screen.findByText('Écran PIN')).toBeInTheDocument()
    expect(refreshs).toBe(0)
  })

  it('sans appareilId (front d’avant B53) : connexion complète, comme avant', async () => {
    appareilDeConfiance()
    localStorage.removeItem(APPAREIL_KEY)
    server.use(http.post(`${API}/v1/auth/refresh`, () => erreur(401, 'SESSION_EXPIRED', 'x')))
    afficher()

    expect(await screen.findByText('Connexion')).toBeInTheDocument()
  })
})
