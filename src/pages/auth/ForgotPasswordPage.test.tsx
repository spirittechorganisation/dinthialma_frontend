/**
 * Caractérisation de ForgotPasswordPage (spec 01, tâche 4.1) — mot de passe oublié en 3 étapes.
 *
 * 1. Téléphone → POST /v1/auth/forgot-password/send-otp { phone } (erreur ignorée : anti-énumération)
 * 2. Code SMS → POST …/verify-otp { phone, code }
 * 3. Nouveau mot de passe → POST …/reset { phone, code, newPassword } → connexion avec message.
 */
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement, etatNavigation } from '@/test/router'
import { ForgotPasswordPage } from './ForgotPasswordPage'

type Corps = Record<string, unknown>

function capture(chemin: string, reponse: () => Response = () => ok(null)) {
  const corps: Corps[] = []
  server.use(http.post(`${API}${chemin}`, async ({ request }) => {
    corps.push((await request.json()) as Corps)
    return reponse()
  }))
  return corps
}

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<p>Connexion</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route: '/forgot-password', auth: null },
  )
}

type User = ReturnType<typeof afficher>['user']

async function etape1(user: User, numero = '771234567') {
  await user.type(screen.getByPlaceholderText('77 000 00 00'), numero)
  await user.click(screen.getByRole('button', { name: 'Envoyer le code SMS' }))
}

async function etape2(user: User, code = '654321') {
  await user.type(await screen.findByPlaceholderText('123456'), code)
  await user.click(screen.getByRole('button', { name: 'Vérifier le code' }))
}

async function etape3(user: User, mdp = 'nouveau123', confirmation = mdp) {
  const [champ, champConfirmation] = await screen.findAllByPlaceholderText('••••••••')
  await user.type(champ, mdp)
  await user.type(champConfirmation, confirmation)
  await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }))
}

describe('[caractérisation] ForgotPasswordPage', () => {
  it('3 étapes : corps envoyés à chaque étape, puis connexion avec « Mot de passe réinitialisé »', async () => {
    const envois = capture('/v1/auth/forgot-password/send-otp')
    const verifs = capture('/v1/auth/forgot-password/verify-otp')
    const resets = capture('/v1/auth/forgot-password/reset')
    const { user } = afficher()

    expect(screen.getByLabelText('Étape 1 sur 3')).toHaveTextContent('Téléphone')
    await etape1(user)
    expect(await screen.findByText(/Code envoyé au/)).toHaveTextContent('Code envoyé au +221771234567')
    await etape2(user)
    expect(await screen.findByLabelText('Étape 3 sur 3')).toHaveTextContent('Nouveau mot de passe')
    await etape3(user)

    await waitFor(() => expect(emplacement()).toBe('/login'))
    expect(etatNavigation()).toEqual({ passwordReset: true })
    expect(envois).toEqual([{ phone: '+221771234567' }])
    expect(verifs).toEqual([{ phone: '+221771234567', code: '654321' }])
    expect(resets).toEqual([{ phone: '+221771234567', code: '654321', newPassword: 'nouveau123' }])
  })

  it('numéro inconnu côté serveur : on passe quand même au code (pas d\'indice sur l\'existence du compte)', async () => {
    capture('/v1/auth/forgot-password/send-otp', () => erreur(404, 'NOT_FOUND', 'Unknown'))
    const { user } = afficher()

    await etape1(user)

    expect(await screen.findByText(/Code envoyé au/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('numéro invalide : message de validation', async () => {
    const envois = capture('/v1/auth/forgot-password/send-otp')
    const { user } = afficher()

    await etape1(user, '7')

    expect(await screen.findByText('Numéro invalide (ex : 77 000 00 00)')).toBeInTheDocument()
    expect(envois).toEqual([])
  })

  it('code refusé : « Code incorrect ou expiré. »', async () => {
    capture('/v1/auth/forgot-password/send-otp')
    capture('/v1/auth/forgot-password/verify-otp', () => erreur(400, 'OTP_INVALID', 'Invalid'))
    const { user } = afficher()

    await etape1(user)
    await etape2(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect ou expiré.')
  })

  it.each([
    ['trop court', 'court', 'court', 'Au moins 8 caractères'],
    ['confirmation différente', 'nouveau123', 'nouveau124', 'Les mots de passe ne correspondent pas'],
  ])('nouveau mot de passe %s : message de validation, rien n\'est envoyé', async (_cas, mdp, confirmation, message) => {
    capture('/v1/auth/forgot-password/send-otp')
    capture('/v1/auth/forgot-password/verify-otp')
    const resets = capture('/v1/auth/forgot-password/reset')
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user, mdp, confirmation)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(resets).toEqual([])
  })

  it('réinitialisation refusée : message fixe, on reste à l\'étape 3', async () => {
    capture('/v1/auth/forgot-password/send-otp')
    capture('/v1/auth/forgot-password/verify-otp')
    capture('/v1/auth/forgot-password/reset', () => erreur(400, 'PASSWORD_UNCHANGED', 'Same'))
    const { user } = afficher()

    await etape1(user)
    await etape2(user)
    await etape3(user)

    // Message fixe : le code PASSWORD_UNCHANGED (traduit ailleurs) n'est pas utilisé ici
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur lors de la réinitialisation. Recommencez.')
    expect(emplacement()).toBe('/forgot-password')
  })

  it('« Renvoyer le code » et « Modifier »', async () => {
    const envois = capture('/v1/auth/forgot-password/send-otp')
    const { user } = afficher()

    await etape1(user)
    await user.click(await screen.findByRole('button', { name: 'Renvoyer le code' }))
    await waitFor(() => expect(envois).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: /Modifier/ }))

    expect(screen.getByRole('button', { name: 'Envoyer le code SMS' })).toBeInTheDocument()
  })

  it('lien « Retour à la connexion »', () => {
    afficher()

    expect(screen.getByRole('link', { name: /Retour à la connexion/ })).toHaveAttribute('href', '/login')
  })
})
