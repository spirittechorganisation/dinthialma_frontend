/**
 * Caractérisation de RegisterPage (spec 01, tâche 4.1) — inscription en 3 étapes.
 *
 * 1. Téléphone → POST /v1/auth/register/send-otp { phone }
 * 2. Code SMS → POST …/verify-otp { phone, code }
 * 3. Identité → POST …/complete { phone, firstName, lastName, password, email?, clientType, deviceInfo }
 *    → session ouverte (B13) puis création du PIN ; sans jetons dans la réponse : connexion.
 * Compte pré-inscrit (F04) : numéro transmis par l'écran de connexion, message d'information.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Depart, Emplacement, emplacement, etatNavigation } from '@/test/router'
import { creerJwt } from '@/test/auth'
import { UserRole } from '@/types/common'
import { getAccessToken, getRefreshToken, getUserPhone, getPinConfigured } from '@/lib/tokenStorage'
import { RegisterPage } from './RegisterPage'

type Corps = Record<string, unknown>

function capture(chemin: string, reponse: () => Response = () => ok(null)) {
  const corps: Corps[] = []
  server.use(http.post(`${API}${chemin}`, async ({ request }) => {
    corps.push((await request.json()) as Corps)
    return reponse()
  }))
  return corps
}

const COMPLETE_AVEC_JETONS = () => ok({
  keycloakId: 'kc-1', phone: '+221771234567', firstName: 'Awa', lastName: 'Diop', role: 'MEMBER',
  access_token: creerJwt([UserRole.USER]), refresh_token: 'refresh-inscription', pin_configured: false,
})

function afficher(state?: unknown) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/depart" element={<Depart to="/register" state={state} />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/pin/setup" element={<p>Créer le PIN</p>} />
        <Route path="/login" element={<p>Connexion</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route: state === undefined ? '/register' : '/depart', auth: null },
  )
}

type User = ReturnType<typeof afficher>['user']

const etape = (n: number) => screen.getByLabelText(`Étape ${n} sur 3`)

async function etape1(user: User, numero = '771234567') {
  await user.type(screen.getByPlaceholderText('77 000 00 00'), numero)
  await user.click(screen.getByRole('button', { name: 'Recevoir le code SMS' }))
}

async function etape2(user: User, code = '654321') {
  await user.type(await screen.findByPlaceholderText('123456'), code)
  await user.click(screen.getByRole('button', { name: 'Vérifier le code' }))
}

async function etape3(user: User, champs: Partial<Record<'prenom' | 'nom' | 'email' | 'mdp' | 'confirmation', string>> = {}) {
  const v = { prenom: 'Awa', nom: 'Diop', email: '', mdp: 'motdepasse1', confirmation: 'motdepasse1', ...champs }
  await user.type(await screen.findByPlaceholderText('Prénom'), v.prenom)
  await user.type(screen.getByPlaceholderText('Nom'), v.nom)
  if (v.email) await user.type(screen.getByPlaceholderText('mon_email@email.com'), v.email)
  const [mdp, confirmation] = screen.getAllByPlaceholderText('••••••••')
  if (v.mdp) await user.type(mdp, v.mdp)
  if (v.confirmation) await user.type(confirmation, v.confirmation)
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('[caractérisation] RegisterPage — parcours', () => {
  it('3 étapes : corps envoyés à chaque étape, session ouverte, création du PIN', async () => {
    const envois = capture('/v1/auth/register/send-otp')
    const verifs = capture('/v1/auth/register/verify-otp')
    const comptes = capture('/v1/auth/register/complete', COMPLETE_AVEC_JETONS)
    const { user } = afficher()

    expect(etape(1)).toHaveTextContent('Étape 1 sur 3 · Téléphone')
    await etape1(user)
    expect(await screen.findByText(/Code envoyé au/)).toHaveTextContent('Code envoyé au +221771234567')
    expect(envois).toEqual([{ phone: '+221771234567' }])
    expect(etape(2)).toHaveTextContent('Vérification')

    await etape2(user)
    await screen.findByPlaceholderText('Prénom')
    expect(verifs).toEqual([{ phone: '+221771234567', code: '654321' }])
    expect(etape(3)).toHaveTextContent('Informations')

    await etape3(user, { email: 'awa@exemple.sn' })

    await waitFor(() => expect(emplacement()).toBe('/pin/setup'))
    expect(comptes).toHaveLength(1)
    expect(comptes[0]).toMatchObject({
      phone: '+221771234567', firstName: 'Awa', lastName: 'Diop', password: 'motdepasse1', email: 'awa@exemple.sn', clientType: 'WEB',
    })
    expect(typeof comptes[0].deviceInfo).toBe('string')
    expect(getAccessToken()).not.toBeNull()
    expect(getRefreshToken()).toBe('refresh-inscription')
    expect(getUserPhone()).toBe('221771234567')
    expect(getPinConfigured()).toBe(false)
  })

  it('email facultatif : absent du corps quand il est vide', async () => {
    capture('/v1/auth/register/send-otp')
    capture('/v1/auth/register/verify-otp')
    const comptes = capture('/v1/auth/register/complete', COMPLETE_AVEC_JETONS)
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user)

    await waitFor(() => expect(comptes).toHaveLength(1))
    expect(comptes[0]).not.toHaveProperty('email')
  })

  it('inscription sans jetons en réponse : connexion avec le message « Compte créé »', async () => {
    capture('/v1/auth/register/send-otp')
    capture('/v1/auth/register/verify-otp')
    capture('/v1/auth/register/complete', () => ok({ keycloakId: 'kc-1', phone: '+221771234567', firstName: 'Awa', lastName: 'Diop', role: 'MEMBER' }))
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user)

    await waitFor(() => expect(emplacement()).toBe('/login'))
    expect(etatNavigation()).toEqual({ registered: true })
    expect(getAccessToken()).toBeNull()
  })

  it('compte pré-inscrit (venant de la connexion) : numéro prérempli et message d\'information', async () => {
    const envois = capture('/v1/auth/register/send-otp')
    const { user } = afficher({ phone: '+221771234567' })

    expect(await screen.findByText(/Votre compte a été créé par votre gestionnaire/)).toHaveAttribute('role', 'status')
    expect(screen.getByPlaceholderText('77 000 00 00')).toHaveValue('771234567')
    await user.click(screen.getByRole('button', { name: 'Recevoir le code SMS' }))

    await waitFor(() => expect(envois).toEqual([{ phone: '+221771234567' }]))
    expect(screen.queryByText(/Votre compte a été créé par votre gestionnaire/)).not.toBeInTheDocument()
  })

  it('« Modifier » revient au téléphone ; « Renvoyer le code » renvoie le SMS', async () => {
    const envois = capture('/v1/auth/register/send-otp')
    const { user } = afficher()

    await etape1(user)
    await user.click(await screen.findByRole('button', { name: 'Renvoyer le code' }))
    await waitFor(() => expect(envois).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: /Modifier/ }))

    expect(screen.getByRole('button', { name: 'Recevoir le code SMS' })).toBeInTheDocument()
    expect(envois).toEqual([{ phone: '+221771234567' }, { phone: '+221771234567' }])
  })

  it('lien « Se connecter »', () => {
    afficher()

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login')
  })
})

describe('[caractérisation] RegisterPage — validation', () => {
  it('numéro invalide', async () => {
    const envois = capture('/v1/auth/register/send-otp')
    const { user } = afficher()

    await etape1(user, '12')

    expect(await screen.findByText('Numéro invalide (ex : 77 000 00 00)')).toBeInTheDocument()
    expect(envois).toEqual([])
  })

  it.each([
    ['moins de 6 chiffres', '123', 'Code à 6 chiffres'],
    ['des lettres', '12a456', 'Chiffres uniquement'],
  ])('code SMS : %s', async (_cas, code, message) => {
    capture('/v1/auth/register/send-otp')
    const verifs = capture('/v1/auth/register/verify-otp')
    const { user } = afficher()

    await etape1(user)
    await etape2(user, code)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(verifs).toEqual([])
  })

  it.each([
    ['prénom trop court', { prenom: 'A' }, 'Au moins 2 caractères'],
    ['mot de passe trop court', { mdp: 'court', confirmation: 'court' }, 'Au moins 8 caractères'],
    ['confirmation différente', { confirmation: 'autrechose' }, 'Les mots de passe ne correspondent pas'],
  ])('identité : %s', async (_cas, champs, message) => {
    capture('/v1/auth/register/send-otp')
    capture('/v1/auth/register/verify-otp')
    const comptes = capture('/v1/auth/register/complete', COMPLETE_AVEC_JETONS)
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user, champs)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(comptes).toEqual([])
  })
})

describe('[caractérisation] RegisterPage — email invalide', () => {
  it('bloqué par la validation native du navigateur : rien n\'est envoyé, le message de l\'app n\'apparaît pas', async () => {
    // Le champ est de type « email » et le formulaire n'a pas `noValidate` : le navigateur refuse l'envoi
    // (bulle native) avant la validation du formulaire ; « Email invalide » (zod) n'est jamais affiché.
    capture('/v1/auth/register/send-otp')
    capture('/v1/auth/register/verify-otp')
    const comptes = capture('/v1/auth/register/complete', COMPLETE_AVEC_JETONS)
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user, { email: 'pas-un-email' })

    const email = screen.getByPlaceholderText('mon_email@email.com') as HTMLInputElement
    expect(email.validity.typeMismatch).toBe(true)
    expect(screen.queryByText('Email invalide')).not.toBeInTheDocument()
    expect(comptes).toEqual([])
  })
})

describe('[caractérisation] RegisterPage — erreurs', () => {
  it('numéro déjà inscrit : message traduit, on reste au téléphone', async () => {
    capture('/v1/auth/register/send-otp', () => erreur(409, 'PHONE_ALREADY_USED', 'Exists'))
    const { user } = afficher()

    await etape1(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce numéro a déjà un compte.')
    expect(etape(1)).toBeInTheDocument()
  })

  it('envoi du SMS impossible (réseau) : message de connexion', async () => {
    capture('/v1/auth/register/send-otp', () => HttpResponse.error())
    const { user } = afficher()

    await etape1(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Pas de connexion. Vérifiez votre réseau et réessayez.')
  })

  it('code refusé : « Code incorrect ou expiré. »', async () => {
    capture('/v1/auth/register/send-otp')
    capture('/v1/auth/register/verify-otp', () => erreur(400, 'OTP_EXPIRED', 'Expired'))
    const { user } = afficher()

    await etape1(user)
    await etape2(user)

    // Message fixe : le code OTP_EXPIRED n'est pas traduit sur cet écran
    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect ou expiré.')
  })

  it('création refusée : message du serveur, on reste à l\'étape 3', async () => {
    capture('/v1/auth/register/send-otp')
    capture('/v1/auth/register/verify-otp')
    capture('/v1/auth/register/complete', () => erreur(400, 'OTP_NOT_VERIFIED', 'Not verified'))
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Vérifiez d’abord le code reçu par SMS.')
    expect(etape(3)).toBeInTheDocument()
  })
})
