/**
 * FR31 — Connexion par mot de passe : appareilId envoyé (B53 : un utilisateur qui a un PIN rend cet appareil
 * de confiance) ; venu de l'écran PIN, la raison est expliquée.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Depart } from '@/test/router'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { getAppareilId } from '@/lib/appareil'
import { setUserPhone, setPinConfigured } from '@/lib/tokenStorage'
import { LoginPage } from './LoginPage'

type Corps = Record<string, unknown>

beforeEach(() => {
  localStorage.clear()
  setUserPhone('221770000001')
  setPinConfigured(true)
})

function afficher(raison?: string) {
  const envois: Corps[] = []
  server.use(http.post(`${API}/v1/auth/login`, async ({ request }) => {
    envois.push((await request.json()) as Corps)
    return ok({ access_token: creerJwt([UserRole.MEMBER]), refresh_token: 'refresh-login', pin_configured: true })
  }))
  const r = renderWithProviders(
    <Routes>
      <Route path="/" element={<Depart to="/login" state={raison ? { raison } : undefined} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accueil" element={<p>Accueil</p>} />
    </Routes>,
    { route: '/', auth: null },
  )
  return { ...r, envois }
}

describe('FR31 LoginPage', () => {
  it('après PIN_SESSION_EXPIRED : explique pourquoi, puis envoie l’appareilId', async () => {
    const { user, envois } = afficher('pin-session')

    expect(await screen.findByText('Pour votre sécurité, reconnectez-vous une fois avec votre mot de passe.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123!')
    await user.click(screen.getByRole('button', { name: /Se connecter/ }))

    expect(await screen.findByText('Accueil')).toBeInTheDocument()
    expect(envois[0]).toMatchObject({ username: '+221770000001', clientType: 'WEB', appareilId: getAppareilId() })
  })

  it('après PIN_DISABLED : « votre code secret a été désactivé »', async () => {
    afficher('pin-desactive')
    expect(await screen.findByText(/Votre code secret a été désactivé après trop d’essais/)).toBeInTheDocument()
  })
})
