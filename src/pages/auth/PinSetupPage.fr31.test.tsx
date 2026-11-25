/**
 * FR31 — Création du PIN avec le mot de passe (B53) : `pin/setup {pin, confirmPin, motDePasse, appareilId,
 * clientType, deviceInfo}` → `{confiance: true}`. Mot de passe faux : redemandé, PIN pas créé.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { Toaster, toast } from 'sonner'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { getAppareilId } from '@/lib/appareil'
import { getPinConfigured, getRefreshToken } from '@/lib/tokenStorage'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { PinSetupPage } from './PinSetupPage'

type Corps = Record<string, unknown>

function afficher(reponses: (() => Response)[]) {
  const envois: Corps[] = []
  let i = 0
  server.use(http.post(`${API}/v1/auth/pin/setup`, async ({ request }) => {
    envois.push((await request.json()) as Corps)
    return reponses[Math.min(i++, reponses.length - 1)]()
  }))
  const r = renderWithProviders(
    <>
      <Routes>
        <Route path="/pin/setup" element={<PinSetupPage />} />
        <Route path="/accueil" element={<p>Accueil</p>} />
      </Routes>
      <Toaster />
    </>,
    { route: '/pin/setup', auth: 'membre' },
  )
  return { ...r, envois }
}

afterEach(() => { toast.dismiss() })

describe('FR31 PinSetupPage', () => {
  it('PIN, confirmation, puis mot de passe : appareil de confiance', async () => {
    const { user, envois } = afficher([() => ok({ confiance: true })])

    await user.keyboard('482913')
    await user.keyboard('482913')
    expect(await screen.findByText('Confirmez votre mot de passe pour que ce téléphone se souvienne de vous.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123!')
    await user.click(screen.getByRole('button', { name: 'Créer mon code secret' }))

    expect(await screen.findByText('Code secret créé : ce téléphone se souviendra de vous.')).toBeInTheDocument()
    expect(envois).toHaveLength(1)
    expect(envois[0]).toMatchObject({ pin: '482913', confirmPin: '482913', motDePasse: 'Secret123!', appareilId: getAppareilId(), clientType: 'WEB' })
    expect(typeof envois[0].deviceInfo).toBe('string')
    expect(getPinConfigured()).toBe(true)
  })

  it('mot de passe faux (INVALID_CREDENTIALS) : redemandé, le PIN n’est pas créé ; puis réussi', async () => {
    const { user, envois } = afficher([
      () => erreur(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects'),
      () => ok({ confiance: true }),
    ])

    await user.keyboard('482913')
    await user.keyboard('482913')
    await user.type(await screen.findByLabelText('Mot de passe'), 'faux')
    await user.click(screen.getByRole('button', { name: 'Créer mon code secret' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect. Votre code secret n’a pas encore été créé.')
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('')

    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123!')
    await user.click(screen.getByRole('button', { name: 'Créer mon code secret' }))
    await screen.findByText('Code secret créé : ce téléphone se souviendra de vous.')
    expect(envois.map((e) => e.motDePasse)).toEqual(['faux', 'Secret123!'])
    expect(envois.every((e) => e.pin === '482913')).toBe(true)
  })

  it('après la création, reconnexion par le PIN : les jetons de la nouvelle session remplacent ceux de la connexion', async () => {
    // B53 : pin/setup avec mot de passe révoque la session du jeton reçu à la connexion, sans renvoyer de jetons
    const loginsPin: Record<string, unknown>[] = []
    server.use(http.post(`${API}/v1/auth/login-pin`, async ({ request }) => {
      loginsPin.push((await request.json()) as Record<string, unknown>)
      return ok({ access_token: creerJwt([UserRole.MEMBER]), refresh_token: 'refresh-session-confiance' })
    }))
    const { user } = afficher([() => ok({ confiance: true })])

    await user.keyboard('482913')
    await user.keyboard('482913')
    await user.type(await screen.findByLabelText('Mot de passe'), 'Secret123!')
    await user.click(screen.getByRole('button', { name: 'Créer mon code secret' }))

    await screen.findByText('Code secret créé : ce téléphone se souviendra de vous.')
    expect(loginsPin).toHaveLength(1)
    expect(loginsPin[0]).toMatchObject({ phone: '221700000001', pin: '482913', appareilId: getAppareilId() })
    expect(getRefreshToken()).toBe('refresh-session-confiance')
  })

  it('jetons renvoyés par pin/setup : pris directement, sans reconnexion', async () => {
    let loginsPin = 0
    server.use(http.post(`${API}/v1/auth/login-pin`, () => { loginsPin++; return ok({}) }))
    const { user } = afficher([() => ok({ confiance: true, access_token: creerJwt([UserRole.MEMBER]), refresh_token: 'refresh-du-setup' })])

    await user.keyboard('482913')
    await user.keyboard('482913')
    await user.type(await screen.findByLabelText('Mot de passe'), 'Secret123!')
    await user.click(screen.getByRole('button', { name: 'Créer mon code secret' }))

    await screen.findByText('Code secret créé : ce téléphone se souviendra de vous.')
    expect(loginsPin).toBe(0)
    expect(getRefreshToken()).toBe('refresh-du-setup')
  })

  it('codes différents : on recommence, rien n’est envoyé', async () => {
    const { user, envois } = afficher([() => ok({ confiance: true })])

    await user.keyboard('482913')
    await user.keyboard('111111')

    expect(await screen.findByText('Les codes ne correspondent pas. Recommencez.')).toBeInTheDocument()
    expect(within(document.body).queryByLabelText('Mot de passe')).not.toBeInTheDocument()
    expect(envois).toHaveLength(0)
  })
})
