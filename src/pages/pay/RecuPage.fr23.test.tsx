/**
 * FR23 — Reçu : la note saisie par le gestionnaire (ex. report du cahier) est visible.
 * Les tests `[caractérisation]` du reçu sont dans RecuPage.test.tsx (sans note : ligne absente).
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneCotisation } from '@/test/factories/cotisation'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { CotisationStatut } from '@/types/common'
import { RecuPage } from './RecuPage'

describe('FR23 RecuPage — note du paiement', () => {
  it('affiche la ligne « Note » quand le paiement en a une', async () => {
    server.use(
      http.get(`${API}/v1/tontines/t1/cotisations/cot1`, () => ok(uneCotisation({
        id: 'cot1', tontineId: 't1', cycleId: 'c1', montant: 44000, methodePaiement: 'CASH', statut: CotisationStatut.VALIDE,
        note: 'Report du cahier du 01/11 au 21/11',
      }))),
      http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', nom: 'Épargne' }))),
      http.get(`${API}/v1/tontines/t1/cycles/c1`, () => ok(unCycle({ id: 'c1' }))),
    )
    renderWithProviders(
      <Routes><Route path="/recu/:tontineId/:cotisationId" element={<RecuPage />} /></Routes>,
      { route: '/recu/t1/cot1', auth: 'gestionnaire' },
    )

    const note = await screen.findByText('Note', { selector: 'dt' })
    expect(note.nextElementSibling).toHaveTextContent('Report du cahier du 01/11 au 21/11')
  })
})
