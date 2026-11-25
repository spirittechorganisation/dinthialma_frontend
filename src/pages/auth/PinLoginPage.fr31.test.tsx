/**
 * FR31 — Connexion par PIN (B53, SE07) : appareilId envoyé ; PIN_SESSION_EXPIRED → mot de passe une fois,
 * numéro gardé ; PIN_LOCKED → compte à rebours, clavier bloqué ; PIN_DISABLED → mot de passe et nouveau PIN ;
 * « Changer de compte » → logout avec appareilId, appareilId gardé.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { Toaster, toast } from 'sonner'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement, etatNavigation } from '@/test/router'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { getAccessToken, getPinConfigured, getRefreshToken, getUserPhone, setPinConfigured, setUserPhone, setTokens } from '@/lib/tokenStorage'
import { APPAREIL_KEY, getAppareilId } from '@/lib/appareil'
import { PinLoginPage } from './PinLoginPage'

type Corps = Record<string, unknown>

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/pin" element={<PinLoginPage />} />
        <Route path="/login" element={<p>Connexion</p>} />
        <Route path="/pin/reset" element={<p>PIN oublié</p>} />
        <Route path="/accueil" element={<p>Accueil</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/pin', auth: null },
  )
}

function loginPin(reponse: () => Response) {
  const envois: Corps[] = []
  server.use(http.post(`${API}/v1/auth/login-pin`, async ({ request }) => {
    envois.push((await request.json()) as Corps)
    return reponse()
  }))
  return envois
}

beforeEach(() => {
  localStorage.clear()
  setUserPhone('221770000001')
  setPinConfigured(true)
  // Déconnexion douce : refresh token gardé, plus de jeton d'accès
  setTokens('', 'refresh-ancien')
  localStorage.removeItem('dinthialma_access_token')
})

afterEach(() => { toast.dismiss() })

describe('FR31 PinLoginPage', () => {
  it('envoie l’appareilId ; succès → accueil', async () => {
    const envois = loginPin(() => ok({ access_token: creerJwt([UserRole.MEMBER]), refresh_token: 'refresh-pin' }))
    const { user } = afficher()

    await user.keyboard('123456')

    expect(await screen.findByText('Accueil')).toBeInTheDocument()
    expect(envois[0]).toMatchObject({ phone: '221770000001', pin: '123456', clientType: 'WEB', appareilId: getAppareilId() })
    expect(getRefreshToken()).toBe('refresh-pin')
  })

  it('PIN_SESSION_EXPIRED : connexion par mot de passe, numéro et PIN gardés', async () => {
    loginPin(() => erreur(401, 'PIN_SESSION_EXPIRED', 'Aucune session active'))
    const { user } = afficher()

    await user.keyboard('123456')

    expect(await screen.findByText('Connexion')).toBeInTheDocument()
    expect(etatNavigation()).toMatchObject({ raison: 'pin-session' })
    expect(getUserPhone()).toBe('221770000001')
    expect(getPinConfigured()).toBe(true)
    expect(getRefreshToken()).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('PIN_LOCKED : compte à rebours, clavier bloqué, « PIN oublié ? » reste proposé', async () => {
    const envois = loginPin(() => erreur(429, 'PIN_LOCKED', 'Verrouillé', { retryAfterSeconds: 900 }))
    const { user } = afficher()

    await user.keyboard('123456')

    expect(await screen.findByText('Trop d’essais. Réessayez dans 15:00')).toBeInTheDocument()
    expect(screen.getByText('Code verrouillé')).toBeInTheDocument()
    await user.keyboard('654321')
    expect(envois).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'PIN oublié ?' })).toBeEnabled()
  })

  it('PIN_DISABLED : message, puis mot de passe ; le PIN est à recréer', async () => {
    loginPin(() => erreur(401, 'PIN_DISABLED', 'PIN désactivé'))
    const { user } = afficher()

    await user.keyboard('123456')

    expect(await screen.findByText(/votre code a été désactivé/)).toBeInTheDocument()
    await waitFor(() => expect(emplacement()).toBe('/login'))
    expect(etatNavigation()).toMatchObject({ raison: 'pin-desactive' })
    expect(getPinConfigured()).toBe(false)
    expect(getUserPhone()).toBe('221770000001')
  })

  it('PIN_NOT_CONFIGURED : mot de passe pour créer le PIN', async () => {
    loginPin(() => erreur(400, 'PIN_NOT_CONFIGURED', 'Pas de PIN'))
    const { user } = afficher()

    await user.keyboard('123456')

    await waitFor(() => expect(emplacement()).toBe('/login'))
    expect(etatNavigation()).toMatchObject({ raison: 'pin-absent' })
    expect(getPinConfigured()).toBe(false)
  })

  it('« Changer de compte » : logout avec l’appareilId, tout effacé sauf l’appareilId', async () => {
    const id = getAppareilId()
    const envois: Corps[] = []
    server.use(http.post(`${API}/v1/auth/logout`, async ({ request }) => { envois.push((await request.json()) as Corps); return ok(null) }))
    const { user } = afficher()

    await user.click((await screen.findAllByRole('button', { name: /Changer de compte/ }))[0])

    expect(await screen.findByText('Connexion')).toBeInTheDocument()
    expect(envois).toEqual([{ refreshToken: 'refresh-ancien', clientType: 'WEB', appareilId: id }])
    expect(getUserPhone()).toBeNull()
    expect(localStorage.getItem(APPAREIL_KEY)).toBe(id)
  })
})
