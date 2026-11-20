/**
 * Caractérisation de PinResetPage (spec 01, tâche 4.1) — réinitialiser le code secret (PIN).
 *
 * 4 étapes : téléphone (prérempli si connu) → POST …/pin/reset/send-otp ; code SMS → POST …/verify-otp ;
 * nouveau PIN ; confirmation → POST /v1/auth/pin/reset { phone, otp, newPin, confirmPin } → /pin.
 * L'envoi du SMS ne révèle pas si le numéro existe (erreur ignorée).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { PinResetPage } from './PinResetPage'

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
        <Route path="/pin/reset" element={<PinResetPage />} />
        <Route path="/pin" element={<p>Connexion par PIN</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/pin/reset', auth: null },
  )
}

type User = ReturnType<typeof afficher>['user']

const champTelephone = () => screen.getByPlaceholderText('77 000 00 00')

async function taper(user: User, chiffres: string) {
  for (const c of chiffres) await user.click(screen.getByRole('button', { name: c }))
}

/** Saisit le numéro et demande le code : on arrive à l'étape du code SMS */
async function jusquAuCode(user: User, numero = '771234567') {
  await user.type(champTelephone(), numero)
  await user.click(screen.getByRole('button', { name: 'Recevoir le code SMS' }))
  return screen.findByPlaceholderText('123456')
}

/** Téléphone et code validés : on arrive au clavier du nouveau PIN */
async function jusquAuNouveauPin(user: User) {
  await user.type(await jusquAuCode(user), '654321')
  await user.click(screen.getByRole('button', { name: /Vérifier le code/ }))
  await screen.findByRole('heading', { name: 'Nouveau PIN' })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  act(() => { toast.dismiss() })
})

describe('[caractérisation] PinResetPage — parcours', () => {
  it('parcours complet : corps envoyés à chaque étape, puis connexion par PIN', async () => {
    const envois = capture('/v1/auth/pin/reset/send-otp')
    const verifs = capture('/v1/auth/pin/reset/verify-otp')
    const resets = capture('/v1/auth/pin/reset')
    const { user } = afficher()

    expect(screen.getByLabelText('Étape 1 sur 4')).toHaveTextContent('Étape 1 sur 4 · Téléphone')
    const code = await jusquAuCode(user)

    expect(screen.getByText(/Code envoyé au/)).toHaveTextContent('Code envoyé au +221771234567')
    expect(envois).toEqual([{ phone: '+221771234567' }])
    await user.type(code, '654321')
    await user.click(screen.getByRole('button', { name: /Vérifier le code/ }))

    expect(await screen.findByRole('heading', { name: 'Nouveau PIN' })).toBeInTheDocument()
    expect(verifs).toEqual([{ phone: '+221771234567', code: '654321' }])
    await taper(user, '908172')
    expect(screen.getByRole('heading', { name: 'Confirmez le PIN' })).toBeInTheDocument()
    await taper(user, '908172')

    expect(await screen.findByText('PIN réinitialisé avec succès !')).toBeInTheDocument()
    await waitFor(() => expect(emplacement()).toBe('/pin'))
    expect(resets).toEqual([{ phone: '+221771234567', otp: '654321', newPin: '908172', confirmPin: '908172' }])
  })

  it('numéro mémorisé sur l\'appareil : prérempli mais refusé tant que le champ n\'est pas retouché', async () => {
    // BUG: le numéro mémorisé est stocké sans « + » (« 221771234567 », voir normalizePhone) alors que la
    // validation (zPhone) exige « +… » : en arrivant depuis « PIN oublié ? », « Recevoir le code SMS »
    // n'affiche que « Numéro invalide » et aucun SMS ne part. Il faut retoucher le champ pour qu'il se
    // normalise en « +221… ». Attendu : numéro prérempli accepté tel quel (préfixé par « + »).
    localStorage.setItem('dinthialma_user_phone', '221771234567')
    const envois = capture('/v1/auth/pin/reset/send-otp')
    const { user } = afficher()

    expect(champTelephone()).toHaveValue('221771234567')
    await user.click(screen.getByRole('button', { name: 'Recevoir le code SMS' }))

    expect(await screen.findByText('Numéro invalide (ex : 77 000 00 00)')).toBeInTheDocument()
    expect(envois).toEqual([])

    // Retoucher le champ (ajouter puis retirer un chiffre) le normalise
    await user.type(champTelephone(), '9{Backspace}')
    expect(champTelephone()).toHaveValue('771234567')
    await user.click(screen.getByRole('button', { name: 'Recevoir le code SMS' }))

    await waitFor(() => expect(envois).toEqual([{ phone: '+221771234567' }]))
  })

  it('numéro inconnu côté serveur : on passe quand même au code (pas d\'indice sur l\'existence du compte)', async () => {
    capture('/v1/auth/pin/reset/send-otp', () => erreur(404, 'NOT_FOUND', 'Unknown'))
    const { user } = afficher()

    await jusquAuCode(user)

    expect(screen.getByText(/Code envoyé au/)).toBeInTheDocument()
  })

  it('numéro trop court : message de validation, rien n\'est envoyé', async () => {
    const envois = capture('/v1/auth/pin/reset/send-otp')
    const { user } = afficher()

    await user.type(champTelephone(), '77')
    await user.click(screen.getByRole('button', { name: 'Recevoir le code SMS' }))

    expect(await screen.findByText('Numéro invalide (ex : 77 000 00 00)')).toBeInTheDocument()
    expect(envois).toEqual([])
  })

  it('« Renvoyer le code » renvoie le SMS au même numéro', async () => {
    const envois = capture('/v1/auth/pin/reset/send-otp')
    const { user } = afficher()

    await jusquAuCode(user)
    await user.click(screen.getByRole('button', { name: 'Renvoyer le code' }))

    expect(await screen.findByText('Nouveau code envoyé')).toBeInTheDocument()
    expect(envois).toEqual([{ phone: '+221771234567' }, { phone: '+221771234567' }])
  })

  it('« Modifier » revient à l\'étape du téléphone', async () => {
    capture('/v1/auth/pin/reset/send-otp')
    const { user } = afficher()

    await jusquAuCode(user)
    await user.click(screen.getByRole('button', { name: /Modifier/ }))

    expect(screen.getByRole('button', { name: 'Recevoir le code SMS' })).toBeInTheDocument()
  })

  it('lien « Retour » vers la connexion par PIN', () => {
    afficher()

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute('href', '/pin')
  })
})

describe('[caractérisation] PinResetPage — erreurs', () => {
  it('code de moins de 6 chiffres : message de validation, rien n\'est envoyé', async () => {
    capture('/v1/auth/pin/reset/send-otp')
    const verifs = capture('/v1/auth/pin/reset/verify-otp')
    const { user } = afficher()

    await user.type(await jusquAuCode(user), '123')
    await user.click(screen.getByRole('button', { name: /Vérifier le code/ }))

    expect(await screen.findByText('Code à 6 chiffres')).toBeInTheDocument()
    expect(verifs).toEqual([])
  })

  it('code refusé : « Code incorrect ou expiré. »', async () => {
    capture('/v1/auth/pin/reset/send-otp')
    capture('/v1/auth/pin/reset/verify-otp', () => erreur(400, 'OTP_INVALID', 'Invalid'))
    const { user } = afficher()

    await user.type(await jusquAuCode(user), '000000')
    await user.click(screen.getByRole('button', { name: /Vérifier le code/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect ou expiré.')
  })

  it('confirmation différente : message, retour au nouveau PIN, rien n\'est envoyé', async () => {
    capture('/v1/auth/pin/reset/send-otp')
    capture('/v1/auth/pin/reset/verify-otp')
    const resets = capture('/v1/auth/pin/reset')
    const { user } = afficher()

    await jusquAuNouveauPin(user)
    await taper(user, '908172')
    await taper(user, '908171')

    expect(await screen.findByText('Les codes ne correspondent pas.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Nouveau PIN' })).toBeInTheDocument()
    expect(resets).toEqual([])
  })

  it('réinitialisation refusée : « Erreur. Recommencez. », retour au nouveau PIN', async () => {
    capture('/v1/auth/pin/reset/send-otp')
    capture('/v1/auth/pin/reset/verify-otp')
    capture('/v1/auth/pin/reset', () => erreur(400, 'PIN_TOO_SIMPLE', 'Too simple'))
    const { user } = afficher()

    await jusquAuNouveauPin(user)
    await taper(user, '111111')
    await taper(user, '111111')

    expect(await screen.findByText('Erreur. Recommencez.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Nouveau PIN' })).toBeInTheDocument()
    expect(emplacement()).toBe('/pin/reset')
  })
})
