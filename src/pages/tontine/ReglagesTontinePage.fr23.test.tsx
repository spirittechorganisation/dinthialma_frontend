/**
 * FR23 — Réglages d'une épargne journalière : libellé du montant libre, « Clôturer la tontine »
 * ouvert depuis une période (?action=cloturer), confirmation forcée, puis retour à la fiche
 * (répartition finale). Ce ne sont pas des tests de caractérisation (Réglages : spec 01 lot H).
 */
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { TontineType } from '@/types/tontine'
import { ReglagesTontinePage } from './ReglagesTontinePage'

function afficher(route: string) {
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, montant: 2000, montantLibre: true, montantMinimum: 2000,
      rythmeIntervalle: 1, rythmeUnite: 'JOUR', dateEcheance: '2026-12-31', monRole: 'GESTIONNAIRE',
    }))),
    http.get(`${API}/v1/tontines/t1/commissions`, () => page([])),
  )
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/tontine/:id/reglages" element={<ReglagesTontinePage />} />
        <Route path="/tontine/:id" element={<p>Fiche</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route, auth: 'gestionnaire' },
  )
}

describe('FR23 ReglagesTontinePage — épargne journalière', () => {
  it('libellé du montant : « Montant libre, minimum 2.000F / jour »', async () => {
    afficher('/tontine/t1/reglages')

    const terme = await screen.findByText('Montant', { selector: 'dt' })
    expect(terme.nextElementSibling).toHaveTextContent('Montant libre, minimum 2.000F / jour')
  })

  it('?action=cloturer : confirmation ouverte, points en suspens, clôture forcée, retour à la fiche', async () => {
    const corps: unknown[] = []
    server.use(http.put(`${API}/v1/tontines/t1/cloturer`, async ({ request }) => {
      const c = await request.json().catch(() => null)
      corps.push(c)
      return (c as { forcer?: boolean } | null)?.forcer
        ? ok(uneTontine({ id: 't1' }))
        : erreur(409, 'TONTINE_CLOTURE_A_CONFIRMER', 'Points en suspens', {
          toursNonRemis: [{ cycleId: 'c3', numeroCycle: 3 }], toursSansGagnant: [], retards: [], complements: [],
        })
    }))
    const { user } = afficher('/tontine/t1/reglages?action=cloturer')

    const confirmation = await screen.findByRole('dialog', { name: 'Clôturer la tontine ?' })
    expect(confirmation).toHaveTextContent('L’épargne est partagée maintenant : chacun reçoit ce qu’il a cotisé.')
    await user.click(within(confirmation).getByRole('button', { name: 'Clôturer' }))
    await user.click(await screen.findByRole('button', { name: 'Clôturer quand même' }))

    expect(await screen.findByText('Fiche')).toBeInTheDocument()
    expect(emplacement()).toBe('/tontine/t1')
    expect(corps[corps.length - 1]).toEqual({ forcer: true })
  })
})
