/**
 * FR25 — Encaisser dans une épargne : « Jour du JJ/MM » (journalier) ou « Période N », jamais « Tour N ».
 * Rotative inchangée. Vue mobile ; horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { AccountStatus, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { CycleRecapLigne } from '@/types/cotisation'
import { EncaisserPage } from './EncaisserPage'

const awa: CycleRecapLigne = {
  membreId: 'm-awa', userId: 'u-awa', firstName: 'Awa', lastName: 'Ndiaye', phone: '+221770009101',
  accountStatus: AccountStatus.PRE_ENROLLED, statutMembre: MembreStatut.ACTIF, ordreJackpot: null,
  cotisationId: null, montant: null, methodePaiement: null, statutCotisation: null, dateValidation: null,
}

const ligneTableau = (id: string, nom: string, type: string, numeroCycle: number) => ({
  tontineId: id, nom, tontineType: type, montant: 2000, montantLibre: false,
  cotisationsEnAttente: 0, cotisationsEnRetard: 0, demandesEnAttente: 0, prioritesEnAttente: 0, montantTotalValide: 0,
  gagnantsADesigner: false,
  cycleEnCours: {
    cycleId: `c-${id}`, numeroCycle, dateFin: '2026-11-22', nombreEcheances: 1, numeroEcheanceCourante: 1, tousPayes: false,
    montantCollecte: 0, montantEnAttente: 0, montantAttendu: null, membresAyantPaye: 0, membresEnAttente: 0, membresActifs: 1,
  },
})

function tableau(lignes: ReturnType<typeof ligneTableau>[]) {
  server.use(http.get(`${API}/v1/admin/my-dashboard`, () => ok({
    nombreTontinesGerees: lignes.length, totalCollecteToursEnCours: 0, totalAttenduToursEnCours: null, totalCotisationsEnAttente: 0,
    tontines: { content: lignes, page: { number: 0, size: 100, totalElements: lignes.length, totalPages: 1 } },
  })))
}

function afficher(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/encaisser" element={<EncaisserPage />} />
      <Route path="/encaisser/:tontineId" element={<EncaisserPage />} />
    </Routes>,
    { route, auth: 'gestionnaire' },
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => { vi.useRealTimers() })

describe('FR25 EncaisserPage — nom de la période', () => {
  it('épargne journalière : « Jour du 22/11 » sur la liste et sur le formulaire', async () => {
    tableau([ligneTableau('t1', 'Épargne', 'EVENEMENTIELLE', 1)])
    server.use(
      http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
        id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, rythmeIntervalle: 1, rythmeUnite: 'JOUR', monRole: 'GESTIONNAIRE',
      }))),
      http.get(`${API}/v1/tontines/t1/cycles/c-t1`, () => ok(unCycle({ id: 'c-t1', statut: CycleStatut.EN_COURS, dateDebut: '2026-11-22', dateFin: '2026-11-22' }))),
      http.get(`${API}/v1/tontines/t1/cotisations/recap/c-t1`, () => page([awa])),
    )
    const { user } = afficher('/encaisser/t1')

    expect(await screen.findByText('Jour du 22/11')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Awa Ndiaye/ }))
    expect(await screen.findByText(/^Jour du 22\/11/)).toBeInTheDocument()
    expect(screen.queryByText(/Tour 1/)).not.toBeInTheDocument()
  })

  it('« Pour quelle tontine ? » : « Période 1 » pour l\'épargne, « Tour 4 » pour la rotative', async () => {
    tableau([ligneTableau('t1', 'Épargne', 'EVENEMENTIELLE', 1), ligneTableau('t2', 'Famille', 'ROTATIVE', 4)])
    afficher('/encaisser')

    expect(await screen.findByText(/^Période 1 ·/)).toBeInTheDocument()
    expect(screen.getByText(/^Tour 4 ·/)).toBeInTheDocument()
  })
})
