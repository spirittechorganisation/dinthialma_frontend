/**
 * FR29 — Encaisser dans une épargne : un membre soldé (retrait total) est rangé avec les « déjà payés »,
 * grisé, mention « Soldé », sans rien à encaisser ; le compteur ne le compte plus.
 * Vue mobile ; horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { unMembre } from '@/test/factories/membre'
import { AccountStatus, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { CycleRecapLigne } from '@/types/cotisation'
import { EncaisserPage } from './EncaisserPage'

const ligne = (id: string, prenom: string): CycleRecapLigne => ({
  membreId: id, userId: `u-${id}`, firstName: prenom, lastName: 'Ndiaye', phone: '+221770009100',
  accountStatus: AccountStatus.PRE_ENROLLED, statutMembre: MembreStatut.ACTIF, ordreJackpot: null,
  cotisationId: null, montant: null, methodePaiement: null, statutCotisation: null, dateValidation: null,
})

function epargne() {
  server.use(
    http.get(`${API}/v1/admin/my-dashboard`, () => ok({
      nombreTontinesGerees: 1, totalCollecteToursEnCours: 0, totalAttenduToursEnCours: null, totalCotisationsEnAttente: 0,
      tontines: {
        content: [{
          tontineId: 't1', nom: 'Épargne', tontineType: 'EVENEMENTIELLE', montant: 2000, montantLibre: true,
          cotisationsEnAttente: 0, cotisationsEnRetard: 0, demandesEnAttente: 0, prioritesEnAttente: 0, montantTotalValide: 0, gagnantsADesigner: false,
          cycleEnCours: {
            cycleId: 'c1', numeroCycle: 1, dateFin: '2026-11-22', nombreEcheances: 1, numeroEcheanceCourante: 1, tousPayes: false,
            montantCollecte: 0, montantEnAttente: 0, montantAttendu: null, membresAyantPaye: 0, membresEnAttente: 0, membresActifs: 2,
          },
        }],
        page: { number: 0, size: 100, totalElements: 1, totalPages: 1 },
      },
    })),
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, montant: 2000, montantLibre: true, montantMinimum: 2000,
      rythmeIntervalle: 1, rythmeUnite: 'JOUR', monRole: 'GESTIONNAIRE',
    }))),
    http.get(`${API}/v1/tontines/t1/cycles/c1`, () => ok(unCycle({ id: 'c1', statut: CycleStatut.EN_COURS, dateDebut: '2026-11-22', dateFin: '2026-11-22' }))),
    http.get(`${API}/v1/tontines/t1/cotisations/recap/c1`, () => page([ligne('m-awa', 'Awa'), ligne('m-binta', 'Binta')])),
    http.get(`${API}/v1/tontines/t1/membres`, () => page([
      unMembre({ id: 'm-awa', soldeLe: null }),
      unMembre({ id: 'm-binta', soldeLe: '2026-11-21T12:00:00' }),
    ])),
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => { vi.useRealTimers() })

describe('FR29 EncaisserPage — membre soldé', () => {
  it('rangé avec les « déjà payés », grisé, « Soldé » ; hors du compteur ; rien à encaisser', async () => {
    epargne()
    renderWithProviders(
      <Routes><Route path="/encaisser/:tontineId" element={<EncaisserPage />} /></Routes>,
      { route: '/encaisser/t1', auth: 'gestionnaire' },
    )

    // Le compteur attend la liste des membres : Binta, soldée, n'est plus attendue
    expect(await screen.findByText('0 / 1 payé aujourd’hui')).toBeInTheDocument()
    const nonPayes = screen.getByRole('heading', { name: /Pas encore payé/ }).closest('section')!
    expect(within(nonPayes).getByText('Awa Ndiaye')).toBeInTheDocument()
    expect(within(nonPayes).queryByText('Binta Ndiaye')).not.toBeInTheDocument()

    const payes = screen.getByRole('heading', { name: /Déjà payé/ }).closest('section')!
    const binta = within(payes).getByText('Binta Ndiaye').closest('li')!
    expect(binta).toHaveTextContent('Soldé')
    expect(binta).toHaveClass('opacity-60')
    expect(within(binta).queryByRole('link')).not.toBeInTheDocument()
    expect(within(binta).queryByRole('button')).not.toBeInTheDocument()
  })

  it('?membre= d’un membre soldé : pas de formulaire, retour à la liste', async () => {
    epargne()
    renderWithProviders(
      <Routes><Route path="/encaisser/:tontineId" element={<EncaisserPage />} /></Routes>,
      { route: '/encaisser/t1?membre=m-binta', auth: 'gestionnaire' },
    )

    expect(await screen.findByText('0 / 1 payé aujourd’hui')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Encaisser/ })).not.toBeInTheDocument()
  })
})
