/**
 * FR23 — Créer une épargne journalière : « Autre » → « Pour un événement », montant libre (minimum 2.000F),
 * chaque jour, jusqu'au 31/12, sans commission.
 *
 * Date de début par défaut : recalculée (heure de Dakar) à l'ouverture de l'étape et juste avant l'envoi ;
 * une date choisie et passée est signalée avant d'envoyer ; `DATE_DEBUT_PASSEE` ramène au champ date.
 * Les tests `[caractérisation]` de la création sont dans CreerTontinePage.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, fireEvent } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { creerJwt } from '@/test/auth'
import { uneTontine } from '@/test/factories/tontine'
import { UserRole } from '@/types/common'
import { CreerTontinePage } from './CreerTontinePage'

type Corps = Record<string, unknown>

function creation(reponse: () => Response = () => ok(uneTontine({ id: 't-new' }))) {
  const envois: Corps[] = []
  server.use(
    http.post(`${API}/v1/tontines`, async ({ request }) => {
      envois.push((await request.json()) as Corps)
      return reponse()
    }),
    http.post(`${API}/v1/auth/refresh`, () => ok({ access_token: creerJwt([UserRole.ADMIN, UserRole.MEMBER]), refresh_token: 'r2' })),
  )
  return { envois }
}

function afficher() {
  return renderWithProviders(
    <Routes>
      <Route path="/creer" element={<CreerTontinePage />} />
    </Routes>,
    { route: '/creer', auth: 'membre' },
  )
}

type User = ReturnType<typeof afficher>['user']

const principal = (nom: string) => screen.getAllByRole('button', { name: nom })[0]
const debut = () => screen.getByLabelText('Début') as HTMLInputElement

/** Étape 2 d'une épargne : « Autre » → « Pour un événement », montant libre minimum 2.000F, chaque jour */
async function epargneJournaliere(user: User) {
  await user.click(screen.getByRole('radio', { name: /^Autre chose/ }))
  await user.click(principal('Continuer'))
  await user.click(within(screen.getByRole('radiogroup', { name: 'Type' })).getByRole('radio', { name: 'Pour un événement' }))
  await user.click(screen.getByRole('checkbox', { name: 'Montant libre' }))
  await user.type(screen.getByRole('textbox', { name: 'Minimum par cotisation (facultatif)' }), '2000')
  const plusCourt = screen.getByRole('button', { name: 'Rythme plus court' })
  while (!(plusCourt as HTMLButtonElement).disabled) await user.click(plusCourt)
  fireEvent.change(screen.getByLabelText('Événement'), { target: { value: '2026-12-31' } })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FR23 CreerTontinePage — récapitulatif d\'une épargne journalière', () => {
  it('dit « chaque jour, minimum 2.000F, jusqu\'au 31 déc., sans commission » et que chacun récupère sa mise', async () => {
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
    const { envois } = creation()
    const { user } = afficher()

    await epargneJournaliere(user)
    await user.click(principal('Continuer'))

    const recap = screen.getByRole('heading', { name: 'Récapitulatif' }).nextElementSibling?.textContent ?? ''
    expect(recap).toContain('Chacun cotise librement (minimum 2.000F) chaque jour, jusqu\'au 31 déc. À la fin, chacun récupère ce qu\'il a cotisé.')
    expect(recap).not.toContain('déc..')
    expect(recap).toContain('sans commission')
    await user.click(principal('Créer la tontine'))

    await screen.findByText('Tontine créée ✓')
    expect(envois[0]).toMatchObject({
      tontineType: 'EVENEMENTIELLE', rythmeIntervalle: 1, rythmeUnite: 'JOUR', dateDebut: '2026-11-22', dateEcheance: '2026-12-31',
      montantLibre: true, montantMinimum: 2000,
    })
    expect(envois[0]).not.toHaveProperty('commissions')
  })
})

describe('FR23 CreerTontinePage — date de début par défaut', () => {
  it('page ouverte la veille au soir : l\'étape propose la date du jour réel (heure de Dakar)', async () => {
    vi.setSystemTime(new Date('2026-11-21T23:50:00Z'))
    const { user } = afficher()
    await user.click(screen.getByRole('radio', { name: /^Autre chose/ }))

    vi.setSystemTime(new Date('2026-11-22T00:10:00Z'))
    await user.click(principal('Continuer'))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Type' })).getByRole('radio', { name: 'Pour un événement' }))

    expect(debut()).toHaveValue('2026-11-22')
  })

  it('minuit passé sur le récapitulatif : la date est recalculée juste avant l\'envoi', async () => {
    vi.setSystemTime(new Date('2026-11-22T23:55:00Z'))
    const { envois } = creation()
    const { user } = afficher()
    await epargneJournaliere(user)
    await user.click(principal('Continuer'))

    vi.setSystemTime(new Date('2026-11-23T00:05:00Z'))
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].dateDebut).toBe('2026-11-23')
  })

  it('date choisie et passée : prévient avant d\'envoyer, « Commencer aujourd\'hui » corrige', async () => {
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
    const { envois } = creation()
    const { user } = afficher()
    await epargneJournaliere(user)
    fireEvent.change(debut(), { target: { value: '2026-11-21' } })
    await user.click(principal('Continuer'))
    await user.click(principal('Créer la tontine'))

    // Retour au champ date, rien n'est parti
    expect(await screen.findByText('La date de début est passée : choisissez aujourd’hui ou une date future.')).toBeInTheDocument()
    expect(debut()).toHaveAttribute('aria-invalid', 'true')
    expect(envois).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Commencer aujourd’hui' }))
    expect(debut()).toHaveValue('2026-11-22')
    await user.click(principal('Continuer'))
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].dateDebut).toBe('2026-11-22')
  })

  it('refus DATE_DEBUT_PASSEE du backend : retour au champ date avec le message', async () => {
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
    creation(() => erreur(400, 'DATE_DEBUT_PASSEE', 'La date de début (21/11/2026) est passée'))
    const { user } = afficher()
    await epargneJournaliere(user)
    await user.click(principal('Continuer'))
    await user.click(principal('Créer la tontine'))

    expect(await screen.findByText('La date de début est passée : choisissez aujourd’hui ou une date future.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Combien et jusqu\'à quand ?' })).toBeInTheDocument()
  })
})
