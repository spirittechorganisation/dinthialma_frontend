/**
 * FR25 — Fiche d'une épargne journalière (gestionnaire) : la période en cours s'appelle « Jour du JJ/MM »,
 * jamais « Tour N ». Horloge : 22/11/2026 à 10h, heure de Dakar.
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
import { CycleStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import { FicheTontinePage } from './FicheTontinePage'

beforeEach(() => {
  // jsdom n'implémente pas Element.scrollTo (utilisé par la rangée de filtres ChipRow)
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => { vi.useRealTimers() })

describe('FR25 FicheTontinePage — nom de la période en cours', () => {
  it('épargne journalière : « Collecté · Jour du 22/11 » et « Jour du 22/11 en cours »', async () => {
    server.use(
      http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
        id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, montant: 2000, montantLibre: true, montantMinimum: 2000,
        rythmeIntervalle: 1, rythmeUnite: 'JOUR', dateEcheance: '2026-12-31', monRole: 'GESTIONNAIRE',
      }))),
      http.get(`${API}/v1/tontines/t1/cycles`, () => page([
        unCycle({ id: 'c22', tontineId: 't1', numeroCycle: 22, statut: CycleStatut.EN_COURS, dateDebut: '2026-11-22', dateFin: '2026-11-22' }),
      ])),
    )
    renderWithProviders(
      <Routes><Route path="/tontine/:id" element={<FicheTontinePage />} /></Routes>,
      { route: '/tontine/t1', auth: 'gestionnaire' },
    )

    expect(await screen.findByText('Collecté · Jour du 22/11')).toBeInTheDocument()
    expect(screen.getByText('Jour du 22/11 en cours')).toBeInTheDocument()
    expect(screen.queryByText(/Tour 22/)).not.toBeInTheDocument()
  })
})
