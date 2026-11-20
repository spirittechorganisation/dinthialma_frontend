/**
 * Caractérisation de LoginPage (spec 01, tâche 4.1) — connexion en deux étapes (numéro, puis mot de passe).
 *
 * POST /v1/auth/login { username: +221…, password, clientType, deviceInfo } → session stockée,
 * redirection : PIN à créer (pin_configured=false) → /pin/setup ; sinon retour mémorisé, ou accueil selon le rôle.
 * Compte pré-inscrit (403 ACCOUNT_PRE_ENROLLED) → écran « Compte non activé » → inscription (F04).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Depart, Emplacement, emplacement, etatNavigation } from '@/test/router'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { getAccessToken, getRefreshToken, getUserPhone, getPinConfigured } from '@/lib/tokenStorage'
import { LoginPage } from './LoginPage'

type Corps = Record<string, unknown>

/** Capture les connexions ; répond avec les jetons d'un utilisateur des rôles donnés */
function connexions(
  reponse: () => Response | Promise<Response> = () => jetons([UserRole.MEMBER]),
) {
  const corps: Corps[] = []
  server.use(http.post(`${API}/v1/auth/login`, async ({ request }) => {
    corps.push((await request.json()) as Corps)
    return reponse()
  }))
  return corps
}

function jetons(roles: UserRole[], pinConfigured: boolean | undefined = true) {
  return ok({ access_token: creerJwt(roles), refresh_token: 'refresh-nouveau', expires_in: 3600, pin_configured: pinConfigured })
}

function afficher(state?: unknown) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/depart" element={<Depart to="/login" state={state} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accueil" element={<p>Accueil</p>} />
        <Route path="/superadmin/dashboard" element={<p>Tableau de bord super admin</p>} />
        <Route path="/pin/setup" element={<p>Créer le PIN</p>} />
        <Route path="/register" element={<p>Inscription</p>} />
        <Route path="/forgot-password" element={<p>Mot de passe oublié</p>} />
        <Route path="/tontine/:id" element={<p>Fiche</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route: state === undefined ? '/login' : '/depart', auth: null },
  )
}

type User = ReturnType<typeof afficher>['user']

async function saisirNumero(user: User, chiffres = '771234567') {
  await user.type(screen.getByLabelText('Numéro de téléphone'), chiffres)
  await user.click(screen.getByRole('button', { name: 'Continuer' }))
}

async function seConnecter(user: User, motDePasse = 'secret123') {
  await user.type(screen.getByLabelText('Mot de passe'), motDePasse)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('[caractérisation] LoginPage — étape 1 : le numéro', () => {
  it('formate le numéro pendant la saisie ; « Continuer » actif à 9 chiffres seulement', async () => {
    const { user } = afficher()

    expect(screen.getByRole('heading', { name: 'Bon retour' })).toBeInTheDocument()
    const champ = screen.getByLabelText('Numéro de téléphone')
    await user.type(champ, '77123456')
    expect(champ).toHaveValue('77 123 45 6')
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled()

    await user.type(champ, '7890') // chiffres au-delà de 9 ignorés
    expect(champ).toHaveValue('77 123 45 67')
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled()
  })

  it('passe à l\'étape 2 sans vérifier l\'existence du numéro (aucune requête)', async () => {
    let requetes = 0
    server.events.on('request:start', () => { requetes++ })
    const { user } = afficher()

    await saisirNumero(user)

    expect(screen.getByRole('heading', { name: 'Votre mot de passe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+221 77 123 45 67/ })).toBeInTheDocument()
    expect(requetes).toBe(0)
    server.events.removeAllListeners()
  })
})

describe('[caractérisation] LoginPage — étape 2 : connexion réussie', () => {
  it('membre : envoie le numéro complet, stocke la session et ouvre l\'accueil', async () => {
    const corps = connexions()
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)

    await waitFor(() => expect(emplacement()).toBe('/accueil'))
    expect(corps).toHaveLength(1)
    expect(corps[0]).toMatchObject({ username: '+221771234567', password: 'secret123', clientType: 'WEB' })
    expect(typeof corps[0].deviceInfo).toBe('string')
    expect(getAccessToken()).not.toBeNull()
    expect(getRefreshToken()).toBe('refresh-nouveau')
    expect(getUserPhone()).toBe('221771234567')
    expect(getPinConfigured()).toBe(true)
  })

  it('super administrateur : ouvre son tableau de bord', async () => {
    connexions(() => jetons([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)

    await waitFor(() => expect(emplacement()).toBe('/superadmin/dashboard'))
  })

  it('PIN pas encore configuré : ouvre la création du PIN', async () => {
    connexions(() => jetons([UserRole.MEMBER], false))
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)

    await waitFor(() => expect(emplacement()).toBe('/pin/setup'))
    expect(getPinConfigured()).toBe(false)
  })

  it('page demandée avant la connexion : y retourne, puis l\'oublie', async () => {
    sessionStorage.setItem('dinthialma_retour_apres_connexion', '/tontine/t1')
    connexions()
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)

    await waitFor(() => expect(emplacement()).toBe('/tontine/t1'))
    expect(sessionStorage.getItem('dinthialma_retour_apres_connexion')).toBeNull()
  })

  it('pendant l\'envoi : bouton inactif, une seule connexion envoyée', async () => {
    const corps = connexions(async () => { await delay(150); return jetons([UserRole.MEMBER]) })
    const { user } = afficher()

    await saisirNumero(user)
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Se connecter/ }))

    await waitFor(() => expect(emplacement()).toBe('/accueil'))
    expect(corps).toHaveLength(1)
  })
})

describe('[caractérisation] LoginPage — erreurs', () => {
  it('mauvais identifiants : message, mot de passe effacé, champ signalé, pas de redirection', async () => {
    connexions(() => erreur(401, 'INVALID_CREDENTIALS', 'Invalid user credentials'))
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user, 'mauvais')

    expect(await screen.findByRole('alert')).toHaveTextContent('Numéro ou mot de passe incorrect.')
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled()
    expect(emplacement()).toBe('/login')
    expect(getAccessToken()).toBeNull()
  })

  it('le message d\'erreur disparaît dès qu\'on retape le mot de passe', async () => {
    connexions(() => erreur(401, 'INVALID_CREDENTIALS', 'Invalid'))
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user, 'mauvais')
    await screen.findByRole('alert')
    await user.type(screen.getByLabelText('Mot de passe'), 'x')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['compte désactivé', () => erreur(403, 'ACCOUNT_DISABLED', 'Disabled'), 'Votre compte est désactivé. Contactez le support.'],
    ['trop de tentatives', () => erreur(429, 'TOO_MANY_REQUESTS', 'Slow down'), 'Trop de tentatives. Réessayez dans quelques instants.'],
    ['erreur réseau', () => HttpResponse.error(), 'Pas de connexion. Vérifiez votre réseau et réessayez.'],
    ['code inconnu sans message', () => HttpResponse.json({}, { status: 500 }), 'Connexion impossible. Réessayez.'],
  ])('%s : message traduit', async (_cas, reponse, message) => {
    connexions(reponse)
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('compte pré-inscrit (403) : écran « Compte non activé » puis inscription avec le numéro', async () => {
    connexions(() => erreur(403, 'ACCOUNT_PRE_ENROLLED', 'Compte non activé'))
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)

    expect(await screen.findByRole('heading', { name: 'Compte non activé' })).toBeInTheDocument()
    expect(screen.getByText('+221771234567')).toBeInTheDocument()
    expect(screen.getByText(/Votre compte a été créé par votre gestionnaire/)).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: /S'inscrire maintenant/ }))

    expect(emplacement()).toBe('/register')
    expect(etatNavigation()).toEqual({ phone: '+221771234567' })
  })

  it('compte pré-inscrit : « Retour à la connexion » revient au mot de passe, vidé', async () => {
    connexions(() => erreur(403, 'ACCOUNT_PRE_ENROLLED', 'Compte non activé'))
    const { user } = afficher()

    await saisirNumero(user)
    await seConnecter(user)
    await user.click(await screen.findByRole('button', { name: 'Retour à la connexion' }))

    expect(screen.getByLabelText('Mot de passe')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('[caractérisation] LoginPage — numéro mémorisé, liens et messages', () => {
  it('numéro connu sur l\'appareil : arrive directement au mot de passe, avec le numéro en pastille', async () => {
    localStorage.setItem('dinthialma_user_phone', '221771234567')
    const { user } = afficher()

    expect(screen.getByRole('heading', { name: 'Bon retour' })).toBeInTheDocument()
    expect(screen.getByText('Entrez votre mot de passe pour continuer.')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Changer de numéro' }))
    expect(screen.getByLabelText('Numéro de téléphone')).toHaveValue('77 123 45 67')
  })

  it('autre numéro saisi que celui mémorisé : titre « Votre mot de passe »', async () => {
    localStorage.setItem('dinthialma_user_phone', '221771234567')
    const { user } = afficher()

    await user.click(screen.getByRole('button', { name: /\+221 77 123 45 67/ }))
    await user.clear(screen.getByLabelText('Numéro de téléphone'))
    await saisirNumero(user, '781112233')

    expect(screen.getByRole('heading', { name: 'Votre mot de passe' })).toBeInTheDocument()
  })

  it('afficher puis masquer le mot de passe', async () => {
    const { user } = afficher()
    await saisirNumero(user)
    const champ = screen.getByLabelText('Mot de passe')

    expect(champ).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(champ).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(champ).toHaveAttribute('type', 'password')
  })

  it.each([
    [{ registered: true }, 'Compte créé avec succès ! Connectez-vous.'],
    [{ passwordReset: true }, 'Mot de passe réinitialisé. Connectez-vous.'],
  ])('message de succès venant de l\'écran précédent (%o)', async (state, message) => {
    afficher(state)

    // Bandeau de succès (role="status"), distinct de la région « Emplacement » des tests
    const bandeaux = await screen.findAllByRole('status')
    expect(bandeaux.map((b) => b.textContent)).toContain(message)
  })

  it('liens « Mot de passe oublié ? » et « S\'inscrire »', async () => {
    const { user } = afficher()

    expect(screen.getByRole('link', { name: 'S\'inscrire' })).toHaveAttribute('href', '/register')
    await saisirNumero(user)
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/forgot-password')
  })
})
