/**
 * FR23 — Fiche d'une épargne journalière, vue gestionnaire.
 *
 * Libellé du montant libre, lancement refusé pour date passée (B46), tour 1 visible sans recharger
 * après le lancement, répartition finale avec les membres sortis (B43, B48), note des paiements.
 * Ce ne sont pas des tests de caractérisation (FicheTontinePage : spec 01 lot H).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { uneCotisation } from '@/test/factories/cotisation'
import { CycleStatut, MembreStatut, TontineStatut } from '@/types/common'
import { TontineType, type Tontine } from '@/types/tontine'
import { FicheTontinePage } from './FicheTontinePage'

function epargne(surcharge: Partial<Tontine> = {}) {
  server.use(http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
    id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, montant: 2000, montantLibre: true, montantMinimum: 2000,
    rythmeIntervalle: 1, rythmeUnite: 'JOUR', frequence: 'JOURNALIERE', dateEcheance: '2026-12-31', monRole: 'GESTIONNAIRE',
    ...surcharge,
  }))))
}

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/tontine/:id" element={<FicheTontinePage />} />
        <Route path="/tontine/:id/modifier" element={<p>Modifier</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route: '/tontine/t1', auth: 'gestionnaire' },
  )
}

beforeEach(() => {
  // jsdom n'implémente pas Element.scrollTo (utilisé par la rangée de filtres ChipRow)
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
  server.use(http.get(`${API}/v1/tontines/t1/cycles`, () => page([])))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FR23 FicheTontinePage — montant libre', () => {
  it('affiche « Montant libre, minimum 2.000F / jour » et pas le minimum seul', async () => {
    epargne()
    afficher()

    expect(await screen.findByText(/Montant libre, minimum 2\.000F \/ jour/)).toBeInTheDocument()
    expect(screen.queryByText(/^2\.000F \/ jour/)).not.toBeInTheDocument()
  })
})

describe('FR23 FicheTontinePage — lancement', () => {
  it('DATE_DEBUT_PASSEE : explique et ouvre la modification de la date', async () => {
    epargne({ statut: TontineStatut.BROUILLON })
    server.use(http.put(`${API}/v1/tontines/t1/activer`, () => erreur(400, 'DATE_DEBUT_PASSEE', 'La date de début (21/11/2026) est passée')))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Lancer la tontine' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Lancer la tontine ?' })
    await user.click(within(dialogue).getByRole('button', { name: 'Lancer' }))

    expect(await within(dialogue).findByRole('alert')).toHaveTextContent('La date de début est passée : choisissez aujourd’hui ou une date future.')
    await user.click(within(dialogue).getByRole('button', { name: 'Modifier la date' }))
    expect(emplacement()).toBe('/tontine/t1/modifier')
  })

  it('lancement réussi : la première période et « Encaisser » apparaissent sans recharger la page', async () => {
    epargne({ statut: TontineStatut.BROUILLON })
    let lancee = false
    server.use(
      http.put(`${API}/v1/tontines/t1/activer`, () => { lancee = true; return ok(uneTontine({ id: 't1', statut: TontineStatut.ACTIVE })) }),
      http.get(`${API}/v1/tontines/t1/cycles`, () => page(lancee ? [unCycle({ id: 'c1', tontineId: 't1', numeroCycle: 1, statut: CycleStatut.EN_COURS })] : [])),
    )
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Lancer la tontine' }))
    // La fiche relit la tontine : on la sert désormais active
    epargne({ statut: TontineStatut.ACTIVE })
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lancer' }))

    // FR25 : épargne journalière, la période porte la date de son jour
    expect(await screen.findByText('Collecté · Jour du 01/11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Encaisser/ })).toBeEnabled()
  })
})

describe('FR23 FicheTontinePage — après la clôture', () => {
  // FR29 : la répartition est relue depuis GET /distribution (B51), plus depuis recap-total
  it('montre la répartition finale par membre, sortis compris', async () => {
    epargne({ statut: TontineStatut.TERMINEE })
    const ligne = (prenom: string, statutMembre: MembreStatut, montantCotise: number) => ({
      membreId: `m-${prenom}`, firstName: prenom, lastName: 'Test', statutMembre,
      montantCotise, montantCommission: 0, montantRetire: 0, montantNet: montantCotise,
    })
    server.use(http.get(`${API}/v1/tontines/t1/distribution`, () => ok({
      tontineId: 't1', cycleId: 'c9', dateDistribution: '2026-12-31T20:00:00', nombreMembres: 2,
      totalCotise: 46000, totalCommission: 0, totalRetire: 0, totalNet: 46000,
      lignes: [ligne('Awa', MembreStatut.ACTIF, 44000), ligne('Coumba', MembreStatut.SORTI, 2000)],
    })))
    afficher()

    const section = (await screen.findByRole('heading', { name: 'Répartition finale' })).closest('section')!
    const coumba = within(section).getByText('Coumba Test').closest('tr')!
    expect(coumba).toHaveTextContent('Sorti')
    expect(coumba).toHaveTextContent('2.000F')
    expect(within(section).getByText('Awa Test').closest('tr')).toHaveTextContent('44.000F')
  })
})

describe('FR23 FicheTontinePage — note des paiements', () => {
  it('affiche la note du gestionnaire dans l\'historique', async () => {
    epargne()
    server.use(http.get(`${API}/v1/tontines/t1/cotisations`, () => page([
      uneCotisation({ id: 'cot1', tontineId: 't1', montant: 44000, note: 'Report du cahier du 01/11 au 21/11' }),
    ])))
    afficher()

    expect((await screen.findAllByText('Report du cahier du 01/11 au 21/11')).length).toBeGreaterThan(0)
  })
})
