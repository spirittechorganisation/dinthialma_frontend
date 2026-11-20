/**
 * Caractérisation de PinSetupPage (spec 01, tâche 4.1) — création du code secret (PIN).
 *
 * Deux saisies de 6 chiffres (création, confirmation) ; si elles sont identiques :
 * POST /v1/auth/pin/setup { pin, confirmPin } puis accueil (ou page demandée). « Plus tard » : sans PIN.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders, type AuthPreset } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { getPinConfigured } from '@/lib/tokenStorage'
import { PinSetupPage } from './PinSetupPage'

function creations(reponse: () => Response = () => ok(null, 'PIN créé')) {
  const corps: unknown[] = []
  server.use(http.post(`${API}/v1/auth/pin/setup`, async ({ request }) => {
    corps.push(await request.json())
    return reponse()
  }))
  return corps
}

function afficher(auth: AuthPreset = 'membre') {
  const rendu = renderWithProviders(
    <>
      <Routes>
        <Route path="/pin/setup" element={<PinSetupPage />} />
        <Route path="/accueil" element={<p>Accueil</p>} />
        <Route path="/login" element={<p>Connexion</p>} />
        <Route path="/tontine/:id" element={<p>Fiche</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/pin/setup', auth },
  )
  // Un nouvel inscrit n'a pas encore de PIN
  localStorage.setItem('dinthialma_pin_configured', 'false')
  return rendu
}

type User = ReturnType<typeof afficher>['user']

async function taper(user: User, chiffres: string) {
  for (const c of chiffres) await user.click(screen.getByRole('button', { name: c }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  act(() => { toast.dismiss() })
})

describe('[caractérisation] PinSetupPage', () => {
  it('création puis confirmation identiques : PIN enregistré, accueil', async () => {
    const corps = creations()
    const { user } = afficher()

    expect(screen.getByRole('heading', { name: 'Créez votre PIN' })).toBeInTheDocument()
    await taper(user, '482915')
    expect(screen.getByRole('heading', { name: 'Confirmez votre PIN' })).toBeInTheDocument()
    expect(screen.getByText('Saisissez à nouveau les mêmes 6 chiffres.')).toBeInTheDocument()
    expect(corps).toEqual([])

    await taper(user, '482915')

    expect(await screen.findByText('PIN configuré avec succès !')).toBeInTheDocument()
    await waitFor(() => expect(emplacement()).toBe('/accueil'))
    expect(corps).toEqual([{ pin: '482915', confirmPin: '482915' }])
    expect(getPinConfigured()).toBe(true)
  })

  it('page demandée avant : y retourne après la création', async () => {
    creations()
    const { user } = afficher()
    sessionStorage.setItem('dinthialma_retour_apres_connexion', '/tontine/t1')

    await taper(user, '482915')
    await taper(user, '482915')

    await waitFor(() => expect(emplacement()).toBe('/tontine/t1'))
  })

  it('confirmation différente : message, puis retour à la création, rien n\'est envoyé', async () => {
    const corps = creations()
    const { user } = afficher()

    await taper(user, '482915')
    await taper(user, '111111')

    expect(await screen.findByText('Les codes ne correspondent pas. Recommencez.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Créez votre PIN' })).toBeInTheDocument()
    expect(corps).toEqual([])
  })

  it('refus du serveur (PIN trop simple) : message générique, retour à la création', async () => {
    creations(() => erreur(400, 'PIN_TOO_SIMPLE', 'Too simple'))
    const { user } = afficher()

    await taper(user, '123456')
    await taper(user, '123456')

    // Message générique : le code PIN_TOO_SIMPLE n'est pas traduit sur cet écran
    expect(await screen.findByText('Erreur lors de la configuration. Réessayez.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Créez votre PIN' })).toBeInTheDocument()
    expect(emplacement()).toBe('/pin/setup')
  })

  it('« Plus tard » : accueil sans PIN, rien n\'est envoyé', async () => {
    const corps = creations()
    const { user } = afficher()

    await user.click(screen.getByRole('button', { name: /Plus tard/ }))

    expect(emplacement()).toBe('/accueil')
    expect(corps).toEqual([])
    expect(getPinConfigured()).toBe(false)
  })

  it('« Plus tard » sans session : connexion', async () => {
    const { user } = afficher(null)

    await user.click(screen.getByRole('button', { name: /Plus tard/ }))

    expect(emplacement()).toBe('/login')
  })
})
