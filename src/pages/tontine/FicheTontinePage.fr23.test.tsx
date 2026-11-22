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
import type { MembreTotalCotisation } from '@/types/cotisation'
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

  it('lancement réussi : le tour 1 et « Encaisser » apparaissent sans recharger la page', async () => {
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

    expect(await screen.findByText('Collecté · Tour 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Encaisser/ })).toBeEnabled()
  })
})

describe('FR23 FicheTontinePage — après la clôture', () => {
  it('montre la répartition finale par membre, sortis compris (inclureSortis)', async () => {
    epargne({ statut: TontineStatut.TERMINEE })
    const appels: URL[] = []
    const total = (prenom: string, statutMembre: MembreStatut, totalCotise: number): MembreTotalCotisation => ({
      membreId: `m-${prenom}`, firstName: prenom, lastName: 'Test', phone: '+221770000000', statutMembre,
      ordreJackpot: null, totalCotise, nombreCotisationsValidees: 1,
    })
    server.use(http.get(`${API}/v1/tontines/t1/cotisations/recap-total`, ({ request }) => {
      appels.push(new URL(request.url))
      return page([total('Awa', MembreStatut.ACTIF, 44000), total('Coumba', MembreStatut.SORTI, 2000)])
    }))
    afficher()

    const section = (await screen.findByRole('heading', { name: 'Répartition finale' })).closest('section')!
    expect(appels[0].searchParams.get('inclureSortis')).toBe('true')
    const coumba = within(section).getByText('Coumba Test').closest('li')!
    expect(coumba).toHaveTextContent('Sorti')
    expect(coumba).toHaveTextContent('2.000F')
    expect(within(section).getByText('Awa Test').closest('li')).toHaveTextContent('44.000F')
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
