/**
 * FR25 — « Points en suspens » de la clôture : une épargne n'a pas de « tours non remis » ;
 * ses périodes restantes sont annulées et la répartition se fait sur ce qui a été encaissé.
 */
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { TontineType } from '@/types/tontine'
import { ReglagesTontinePage } from './ReglagesTontinePage'

async function pointsEnSuspens(tontineType: TontineType) {
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', nom: 'Groupe', tontineType, monRole: 'GESTIONNAIRE' }))),
    http.get(`${API}/v1/tontines/t1/commissions`, () => page([])),
    http.put(`${API}/v1/tontines/t1/cloturer`, () => erreur(409, 'TONTINE_CLOTURE_A_CONFIRMER', 'Points en suspens', {
      toursNonRemis: [{ cycleId: 'c9', numeroCycle: 9 }, { cycleId: 'c10', numeroCycle: 10 }],
      toursSansGagnant: [{ cycleId: 'c8', numeroCycle: 8 }], retards: [], complements: [], cotisationsAValider: 0,
    })),
  )
  const { user } = renderWithProviders(
    <Routes><Route path="/tontine/:id/reglages" element={<ReglagesTontinePage />} /></Routes>,
    { route: '/tontine/t1/reglages?action=cloturer', auth: 'gestionnaire' },
  )
  await user.click(within(await screen.findByRole('dialog', { name: 'Clôturer la tontine ?' })).getByRole('button', { name: 'Clôturer' }))
  return screen.findByRole('dialog', { name: 'Points en suspens' })
}

describe('FR25 ReglagesTontinePage — points en suspens', () => {
  it('épargne : « 2 périodes à venir seront annulées », ni tour non remis ni gagnant', async () => {
    const dialogue = await pointsEnSuspens(TontineType.EVENEMENTIELLE)

    expect(dialogue).toHaveTextContent('2 périodes à venir seront annulées, la répartition se fera sur ce qui a été encaissé')
    expect(dialogue).not.toHaveTextContent(/non remis/)
    expect(dialogue).not.toHaveTextContent(/gagnant/)
    expect(dialogue).not.toHaveTextContent(/Les tours déjà commencés/)
  })

  it('rotative : inchangée (tours non remis, sans gagnant)', async () => {
    const dialogue = await pointsEnSuspens(TontineType.ROTATIVE)

    expect(dialogue).toHaveTextContent('2 tours non remis')
    expect(dialogue).toHaveTextContent('1 tour sans gagnant désigné')
  })
})
