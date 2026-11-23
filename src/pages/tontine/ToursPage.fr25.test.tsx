/** FR25 — Liste des périodes : pas de pastille « Jackpot prêt » dans une épargne (événementielle). */
import { describe, it, expect } from 'vitest'
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
import { ToursPage } from './ToursPage'

function afficher(tontineType: TontineType) {
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', nom: 'Groupe', tontineType, monRole: 'GESTIONNAIRE' }))),
    http.get(`${API}/v1/tontines/t1/cycles`, () => page([unCycle({ id: 'c1', numeroCycle: 1, statut: CycleStatut.EN_COURS, tousPayes: true })])),
  )
  return renderWithProviders(
    <Routes><Route path="/tontine/:id/tours" element={<ToursPage />} /></Routes>,
    { route: '/tontine/t1/tours', auth: 'gestionnaire' },
  )
}

describe('FR25 ToursPage — pastille « Jackpot prêt »', () => {
  it('épargne : tout le monde a payé, pas de « Jackpot prêt »', async () => {
    afficher(TontineType.EVENEMENTIELLE)

    expect(await screen.findByText('Période 1')).toBeInTheDocument()
    expect(screen.queryByText('Jackpot prêt')).not.toBeInTheDocument()
  })

  it('rotative : inchangée, « Jackpot prêt » quand tout le monde a payé', async () => {
    afficher(TontineType.ROTATIVE)

    expect(await screen.findByText('Tour 1')).toBeInTheDocument()
    expect(screen.getByText('Jackpot prêt')).toBeInTheDocument()
  })
})
