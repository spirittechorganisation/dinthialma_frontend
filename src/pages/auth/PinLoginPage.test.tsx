/**
 * Caractérisation de PinLoginPage (spec 01, tâche 4.1) — connexion par code secret (PIN) à 6 chiffres.
 *
 * L'appareil connaît le téléphone et garde le refresh token (déconnexion « douce »).
 * Le 6ᵉ chiffre envoie POST /v1/auth/login-pin { phone, pin, clientType, deviceInfo } automatiquement.
 * Erreurs : PIN faux, verrouillé (délai), expiré (→ /pin/reset), session PIN perdue (→ /login, appareil oublié).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { http, HttpResponse } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { connecter, creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { getAccessToken, getRefreshToken, getUserPhone } from '@/lib/tokenStorage'
import { PinLoginPage } from './PinLoginPage'

type Corps = Record<string, unknown>

/** Appareil déjà utilisé : téléphone, refresh token et PIN configuré, sans jeton d'accès */
function appareilConnu() {
  localStorage.setItem('dinthialma_user_phone', '221771234567')
  localStorage.setItem('dinthialma_refresh_token', 'refresh-appareil')
  localStorage.setItem('dinthialma_client_type', 'WEB')
  localStorage.setItem('dinthialma_pin_configured', 'true')
}

function connexionsPin(reponse: () => Response = () => ok({ access_token: creerJwt([UserRole.MEMBER]), refresh_token: 'refresh-pin' })) {
  const corps: Corps[] = []
  server.use(http.post(`${API}/v1/auth/login-pin`, async ({ request }) => {
    corps.push((await request.json()) as Corps)
    return reponse()
  }))
  return corps
}

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/pin" element={<PinLoginPage />} />
        <Route path="/login" element={<p>Connexion par mot de passe</p>} />
        <Route path="/pin/reset" element={<p>Réinitialiser le PIN</p>} />
        <Route path="/accueil" element={<p>Accueil</p>} />
        <Route path="/superadmin/dashboard" element={<p>Super admin</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/pin', auth: null },
  )
}

type User = ReturnType<typeof afficher>['user']

async function taper(user: User, chiffres: string) {
  for (const c of chiffres) await user.click(screen.getByRole('button', { name: c }))
}
const pastilles = () => screen.getByLabelText(/chiffre\(s\) saisi\(s\) sur 6/)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  act(() => { toast.dismiss() })
})

describe('[caractérisation] PinLoginPage — connexion', () => {
  it('affiche le numéro ; le 6ᵉ chiffre envoie le PIN et ouvre l\'accueil', async () => {
    appareilConnu()
    const corps = connexionsPin()
    const { user } = afficher()

    expect(screen.getByRole('heading', { name: 'Bon retour' })).toBeInTheDocument()
    expect(screen.getByText('+221 77 123 45 67')).toBeInTheDocument()
    await taper(user, '12345')
    expect(pastilles()).toHaveAttribute('aria-label', '5 chiffre(s) saisi(s) sur 6')
    expect(corps).toHaveLength(0)

    await taper(user, '6')

    await waitFor(() => expect(emplacement()).toBe('/accueil'))
    expect(corps).toHaveLength(1)
    expect(corps[0]).toMatchObject({ phone: '221771234567', pin: '123456', clientType: 'WEB' })
    expect(typeof corps[0].deviceInfo).toBe('string')
    expect(getRefreshToken()).toBe('refresh-pin')
    expect(getAccessToken()).not.toBeNull()
  })

  it('le clavier physique fonctionne aussi (chiffres et retour arrière)', async () => {
    appareilConnu()
    const corps = connexionsPin()
    const { user } = afficher()

    await user.keyboard('129{Backspace}3456')

    await waitFor(() => expect(corps).toHaveLength(1))
    expect(corps[0].pin).toBe('123456')
  })

  it('« Effacer » retire le dernier chiffre', async () => {
    appareilConnu()
    const { user } = afficher()

    expect(screen.getByRole('button', { name: 'Effacer' })).toBeDisabled()
    await taper(user, '12')
    await user.click(screen.getByRole('button', { name: 'Effacer' }))

    expect(pastilles()).toHaveAttribute('aria-label', '1 chiffre(s) saisi(s) sur 6')
  })

  it('super administrateur : ouvre son tableau de bord', async () => {
    appareilConnu()
    connexionsPin(() => ok({ access_token: creerJwt([UserRole.SUPER_ADMIN]), refresh_token: 'r' }))
    const { user } = afficher()

    await taper(user, '123456')

    await waitFor(() => expect(emplacement()).toBe('/superadmin/dashboard'))
  })

  it('déjà connecté (jeton valide) : redirection immédiate', async () => {
    appareilConnu()
    connecter([UserRole.MEMBER], { phone: '+221771234567' })
    afficher()

    await waitFor(() => expect(emplacement()).toBe('/accueil'))
  })

  it('aucun numéro sur l\'appareil : connexion par mot de passe', async () => {
    afficher()

    await waitFor(() => expect(emplacement()).toBe('/login'))
  })
})

describe('[caractérisation] PinLoginPage — erreurs', () => {
  it('PIN faux : message, saisie remise à zéro, on reste sur l\'écran', async () => {
    appareilConnu()
    connexionsPin(() => erreur(401, 'PIN_INVALID', 'Bad PIN'))
    const { user } = afficher()

    await taper(user, '000000')

    expect(await screen.findByText('Code secret incorrect.')).toBeInTheDocument()
    expect(pastilles()).toHaveAttribute('aria-label', '0 chiffre(s) saisi(s) sur 6')
    expect(emplacement()).toBe('/pin')
  })

  it.each([
    [300, 'Code verrouillé. Réessayez dans 5 min.'],
    [61, 'Code verrouillé. Réessayez dans 2 min.'],
    [null, 'Code verrouillé. Réessayez plus tard.'],
  ])('PIN verrouillé (retryAfterSeconds = %s) : délai affiché en minutes', async (secondes, message) => {
    appareilConnu()
    connexionsPin(() => erreur(423, 'PIN_LOCKED', 'Locked', secondes ? { retryAfterSeconds: secondes } : undefined))
    const { user } = afficher()

    await taper(user, '111111')

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(emplacement()).toBe('/pin')
  })

  it('PIN expiré : message traduit et réinitialisation du PIN', async () => {
    appareilConnu()
    connexionsPin(() => erreur(403, 'PIN_EXPIRED', 'Expired'))
    const { user } = afficher()

    await taper(user, '123456')

    expect(await screen.findByText('Votre code secret a expiré. Choisissez-en un nouveau.')).toBeInTheDocument()
    expect(emplacement()).toBe('/pin/reset')
  })

  it.each(['PIN_SESSION_EXPIRED', 'SESSION_EXPIRED', 'NOT_FOUND', 'PIN_NOT_CONFIGURED'])(
    '%s : appareil oublié, connexion par mot de passe',
    async (code) => {
      appareilConnu()
      connexionsPin(() => erreur(401, code, 'Session'))
      const { user } = afficher()

      await taper(user, '123456')

      await waitFor(() => expect(emplacement()).toBe('/login'))
      expect(getUserPhone()).toBeNull()
      expect(getRefreshToken()).toBeNull()
    },
  )

  it('erreur réseau : message de connexion, on reste sur l\'écran', async () => {
    appareilConnu()
    connexionsPin(() => HttpResponse.error())
    const { user } = afficher()

    await taper(user, '123456')

    expect(await screen.findByText('Pas de connexion. Vérifiez votre réseau et réessayez.')).toBeInTheDocument()
    expect(emplacement()).toBe('/pin')
  })
})

describe('[caractérisation] PinLoginPage — autres actions', () => {
  it('« PIN oublié ? » ouvre la réinitialisation', async () => {
    appareilConnu()
    const { user } = afficher()

    await user.click(screen.getByRole('button', { name: 'PIN oublié ?' }))

    expect(emplacement()).toBe('/pin/reset')
  })

  it('« Changer de compte » : ferme la session côté serveur, oublie l\'appareil, connexion par mot de passe', async () => {
    appareilConnu()
    const corps: unknown[] = []
    server.use(http.post(`${API}/v1/auth/logout`, async ({ request }) => {
      corps.push(await request.json())
      return ok(null)
    }))
    const { user } = afficher()

    await user.click(screen.getAllByRole('button', { name: 'Changer de compte' })[0])

    await waitFor(() => expect(emplacement()).toBe('/login'))
    expect(corps).toEqual([{ refreshToken: 'refresh-appareil', clientType: 'WEB' }])
    expect(getUserPhone()).toBeNull()
  })

  it('« Changer de compte » hors ligne : l\'appareil est oublié quand même', async () => {
    appareilConnu()
    server.use(http.post(`${API}/v1/auth/logout`, () => HttpResponse.error()))
    const { user } = afficher()

    await user.click(screen.getAllByRole('button', { name: 'Changer de compte' })[0])

    await waitFor(() => expect(emplacement()).toBe('/login'))
    expect(getRefreshToken()).toBeNull()
  })
})
