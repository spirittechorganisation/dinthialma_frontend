/**
 * FR23 — Payer, côté membre : période événementielle pas commencée (B47), participation suspendue
 * ou terminée (B44). Les tests `[caractérisation]` de PayerPage sont dans PayerPage.test.tsx.
 *
 * Horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { PayerPage } from './PayerPage'

type Brut = Record<string, unknown>

/** Ligne « Je cotise » d'une épargne journalière ; période du `dateDebut` donné */
function epargne(surcharge: Brut = {}, dateDebut = '2026-11-22', due: Brut | null = {}) {
  server.use(http.get(`${API}/v1/me/summary`, () => ok({
    totalCotiseValide: 0, totalEnAttente: 0,
    tontines: [{
      tontineId: 't1', nom: 'Épargne', tontineType: 'EVENEMENTIELLE', statut: 'ACTIVE', cotisationsParTour: 1, echeancesARegulariser: [],
      monMembreId: 'm1', monStatutMembre: 'ACTIF', ordreJackpot: null, aRecuJackpot: false,
      totalCotiseValide: 44000, totalEnAttente: 0, toursPayes: 1, toursTotal: 40,
      cycleEnCours: { cycleId: 'c2', numeroCycle: 2, dateDebut, dateFin: dateDebut },
      cotisationDue: due === null ? null : {
        montant: null, montantLibre: true, montantMinimum: 2000, dateLimite: dateDebut,
        statut: 'A_PAYER', cotisationId: null, echeancesEnRetard: 0, ...due,
      },
      gestionnaire: { firstName: 'Khadija', lastName: 'Camara', phone: '+221773880047' },
      ...surcharge,
    }],
  })))
}

function afficher() {
  return renderWithProviders(
    <Routes>
      <Route path="/payer/:tontineId" element={<PayerPage />} />
    </Routes>,
    { route: '/payer/t1', auth: 'membre' },
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FR23 PayerPage — épargne journalière', () => {
  it('période qui commence demain : pas de paiement d\'avance, la date est donnée', async () => {
    epargne({}, '2026-11-23')
    afficher()

    expect(await screen.findByText('Pas encore ouverte')).toBeInTheDocument()
    expect(screen.getByText('Cette période commence le 23/11 : les paiements s\'enregistrent à partir de ce jour-là.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Pavé numérique')).not.toBeInTheDocument()
  })

  it.each([
    ['SORTI', 'Participation terminée'],
    ['SUSPENDU', 'Participation suspendue'],
  ])('membre %s : explique qu\'il ne peut plus cotiser', async (statut, titre) => {
    epargne({ monStatutMembre: statut }, '2026-11-22', null)
    afficher()

    expect(await screen.findByText(titre)).toBeInTheDocument()
    expect(screen.getByText('Vous ne pouvez plus cotiser dans Épargne. Contactez votre gestionnaire.')).toBeInTheDocument()
  })

  it('refus MEMBRE_INACTIF (statut changé entre-temps) : texte pour le membre', async () => {
    epargne()
    server.use(http.post(`${API}/v1/tontines/t1/cotisations`, () => erreur(400, 'MEMBRE_INACTIF', 'Votre participation à cette tontine est terminée')))
    const { user } = afficher()

    const pave = await screen.findByLabelText('Pavé numérique')
    await user.click(within(pave).getByRole('button', { name: '2' }))
    await user.click(within(pave).getByRole('button', { name: '000' }))
    await user.click(screen.getByRole('button', { name: /Confirmer mon paiement/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Votre participation à cette tontine est suspendue ou terminée : vous ne pouvez plus cotiser. Contactez votre gestionnaire.')
  })
})
