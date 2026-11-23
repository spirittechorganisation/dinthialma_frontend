/**
 * FR29 — Fiche d'une épargne : épargne par membre (Cotisé, Retiré, Solde) pendant l'épargne ;
 * répartition finale relue depuis GET /distribution (B51). Horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { MembreStatut, TontineStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { MembreTotalCotisation } from '@/types/cotisation'
import type { DistributionFinale, LigneDistribution } from '@/types/retrait'
import { FicheTontinePage } from './FicheTontinePage'

function epargne(statut: TontineStatut, monRole: 'GESTIONNAIRE' | 'MEMBRE' = 'GESTIONNAIRE') {
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, statut, monRole, montant: 2000, montantLibre: true,
      montantMinimum: 2000, rythmeIntervalle: 1, rythmeUnite: 'JOUR', dateEcheance: '2026-12-31',
    }))),
    http.get(`${API}/v1/tontines/t1/cycles`, () => page([])),
  )
}

const total = (prenom: string, totalCotise: number, totalRetire: number, soldeLe: string | null = null): MembreTotalCotisation => ({
  membreId: `m-${prenom}`, firstName: prenom, lastName: 'Test', phone: '+221770000000', statutMembre: MembreStatut.ACTIF,
  ordreJackpot: null, totalCotise, nombreCotisationsValidees: 1, totalRetire, solde: totalCotise - totalRetire, soldeLe,
})

const ligne = (prenom: string, cotise: number, retire: number, commission = 0, statutMembre = MembreStatut.ACTIF): LigneDistribution => ({
  membreId: `m-${prenom}`, firstName: prenom, lastName: 'Test', statutMembre,
  montantCotise: cotise, montantCommission: commission, montantRetire: retire, montantNet: cotise - commission - retire,
})

const distribution = (lignes: LigneDistribution[], totalCommission = 0): DistributionFinale => ({
  tontineId: 't1', cycleId: 'c41', dateDistribution: '2026-12-31T20:00:00', nombreMembres: lignes.length,
  totalCotise: lignes.reduce((s, l) => s + l.montantCotise, 0), totalCommission,
  totalRetire: lignes.reduce((s, l) => s + l.montantRetire, 0), totalNet: lignes.reduce((s, l) => s + l.montantNet, 0), lignes,
})

function afficher(auth: 'gestionnaire' | 'membre' = 'gestionnaire') {
  return renderWithProviders(
    <Routes><Route path="/tontine/:id" element={<FicheTontinePage />} /></Routes>,
    { route: '/tontine/t1', auth },
  )
}

const section = async (titre: string) => (await screen.findByRole('heading', { name: titre })).closest('section')!

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => { vi.useRealTimers() })

describe('FR29 FicheTontinePage — épargne par membre', () => {
  it('colonnes Cotisé, Retiré, Solde, badge « Soldé » et totaux', async () => {
    epargne(TontineStatut.ACTIVE)
    server.use(http.get(`${API}/v1/tontines/t1/cotisations/recap-total`, () => page([
      total('Awa', 44000, 10000), total('Binta', 20000, 20000, '2026-11-21T12:00:00'),
    ])))
    afficher()

    const tableau = within(await section('Épargne par membre'))
    expect(tableau.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Membre', 'Cotisé', 'Retiré', 'Solde'])
    expect(tableau.getByText('Awa Test').closest('tr')).toHaveTextContent('44.000F10.000F34.000F')
    const binta = tableau.getByText('Binta Test').closest('tr')!
    expect(binta).toHaveTextContent('Soldé')
    expect(binta).toHaveTextContent('20.000F20.000F0F')
    expect(tableau.getByRole('rowheader', { name: 'Total' }).closest('tr')).toHaveTextContent('64.000F30.000F34.000F')
  })
})

describe('FR29 FicheTontinePage — répartition finale (/distribution)', () => {
  it('gestionnaire : toutes les lignes, Cotisé, Retiré, Net, totaux et date', async () => {
    epargne(TontineStatut.TERMINEE)
    server.use(http.get(`${API}/v1/tontines/t1/distribution`, () => ok(distribution([ligne('Awa', 44000, 10000), ligne('Binta', 20000, 20000)]))))
    afficher()

    const s = await section('Répartition finale')
    expect(s).toHaveTextContent('Faite le 31 déc. · 2 membres')
    expect(within(s).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Membre', 'Cotisé', 'Retiré', 'Net'])
    expect(within(s).getByText('Awa Test').closest('tr')).toHaveTextContent('44.000F10.000F34.000F')
    expect(within(s).getByText('Binta Test').closest('tr')).toHaveTextContent('Soldé')
    expect(within(s).getByRole('rowheader', { name: 'Total' }).closest('tr')).toHaveTextContent('64.000F30.000F34.000F')
  })

  it('avec commission : colonne « Comm. »', async () => {
    epargne(TontineStatut.TERMINEE)
    server.use(http.get(`${API}/v1/tontines/t1/distribution`, () => ok(distribution([ligne('Awa', 44000, 0, 440)], 440))))
    afficher()

    const s = await section('Répartition finale')
    expect(within(s).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Membre', 'Cotisé', 'Retiré', 'Comm.', 'Net'])
    expect(within(s).getByText('Awa Test').closest('tr')).toHaveTextContent('44.000F0F440F43.560F')
  })

  it('membre : sa ligne seulement, sans totaux', async () => {
    epargne(TontineStatut.TERMINEE, 'MEMBRE')
    server.use(http.get(`${API}/v1/tontines/t1/distribution`, () => ok({ ...distribution([ligne('Awa', 44000, 10000)]), nombreMembres: 12 })))
    afficher('membre')

    const s = await section('Répartition finale')
    expect(s).toHaveTextContent('votre part')
    expect(within(s).getAllByRole('row')).toHaveLength(2)
    expect(within(s).queryByRole('rowheader', { name: 'Total' })).not.toBeInTheDocument()
  })

  it('pas encore distribuée (404 DISTRIBUTION_NON_FAITE) : rien, sans message d’erreur', async () => {
    epargne(TontineStatut.ACTIVE)
    let appels = 0
    server.use(
      http.get(`${API}/v1/tontines/t1/cotisations/recap-total`, () => page([total('Awa', 44000, 0)])),
      http.get(`${API}/v1/tontines/t1/distribution`, () => { appels++; return erreur(404, 'DISTRIBUTION_NON_FAITE', 'Distribution finale pas encore faite') }),
    )
    afficher()

    await section('Épargne par membre')
    await vi.waitFor(() => expect(appels).toBeGreaterThan(0))
    expect(screen.queryByRole('heading', { name: 'Répartition finale' })).not.toBeInTheDocument()
    expect(screen.queryByText(/pas encore faite|erreur/i)).not.toBeInTheDocument()
  })
})
